---
title: "My OpenClaw agent failed to deliver my morning brief a third of the time, so I made it durable with Temporal"
description: "An AI agent that calls free APIs will fail constantly. Temporal makes it reliable without rewriting the agent itself."
pubDate: 2026-03-17
tags: ["openclaw", "durable execution"]
---

Like so many people I know, when OpenClaw came out, I rushed to try it out because it felt like the closest thing we have to Tony Stark's Jarvis from the Marvel Universe. 

I dusted off an old Intel NUC I have lying around under my bed, installed Linux on it, ran the OpenClaw install script, and connected it to Telegram. I gave my new home assistant a name: Dylan.

## What can Dylan do, really?

I did what everyone does — I went online and browsed what other people were using their agents for. Home automation, meal planning, smart reminders, calendar management. I asked Dylan himself what he could do for me. He gave me a long, enthusiastic list.

I went through every suggestion. Most of them fell into one of two buckets: things I don't actually need automated, or things I can already do faster in ChatGPT or Claude — tools I'm already paying for and have open on my laptop all day. Dylan runs on API tokens, so every interaction burns tokens I have to pay for, and for anything conversational I'd rather just use the chatbot I already have a subscription to. The home automation stuff was a non-starter because I don't have smart lights or really any smart devices at all.

> Side note/small rant: I saw some people say they have their agent summarize new videos or podcasts from their favorite content creator. The thought of doing doing irritated me so much. If it's a content creator you love why would you not just listen to the podcast or watch the video?  

The gap between "theoretically useful" and "actually saves me time in my specific life" turned out to be wide. Agents are impressive technology, but for me, running a headless AI on a box under my bed felt a bit like owning a sports car in a city with no highways.

## Getting value out of Dylan

I almost shelved the whole thing. But I kept the morning brief cron job running — it pulls my Google Calendar and Gmail, runs it through an LLM, and sends me a Telegram message every morning at 8:30. And over the next few weeks, I kept thinking about what Dylan could actually do that nothing else in my life already does.

The first thing I landed on was USPS Informed Delivery. If you're signed up for it, USPS sends you an email every morning with scanned images of your incoming mail. The problem is that these emails are just images — there's no structured data, no metadata about who the mail is from. You have to open each image and squint at it yourself. I added Tesseract OCR to Dylan's pipeline so he downloads the scanned images, extracts whatever text he can, and includes it in the brief. The OCR output is often garbled — envelope text doesn't scan cleanly — but it's enough to tell the difference between a bill from the electric company and junk mail. 

This is the kind of thing that no existing app does well, because it requires chaining together email access, image downloading, OCR, and summarization into one pipeline. I feel like it has genuinely added to my life because checking the Informed Delivery emails was actually a chore, and there was no way of querying when I got which mail since everything was images. Now I know when I need to walk downstairs to open my mailbox, and can easily check historical mail dates if I need to.

The second thing was a lunch conflict check. I have a habit of working through my lunch break when I'm in a flow state or need to get something done, which means I sometimes come back from lunch later than planned. More than once I've been heads-down until 12:50, not realizing I had a 1 PM meeting, and had to either sprint back to my desk still hungry or — worse — forget about the meeting entirely. Dylan now flags any meetings between 11am and 2pm in the morning brief, and sends me reminders at 30 minutes, 15 minutes, and 5 minutes before. This one is admittedly simpler — you could probably get Gemini or any calendar assistant to do something similar. But having it built into the same pipeline means I'm less likely to miss it as long as I keep that pipeline (Telegram) high-signal. 

These are small things, but they have indeed added to my life, however modestly. And the important thing is this tech is still new, and _I_ am still new at this, too. Given time, I feel confident I can find new ways to get more value out of Dylan. 

## Running into the reliability problem

On the third morning, I was still fresh with excitement and looking forward to my brief. 8:30 came and went. Nothing. I messaged Dylan and asked what happened. He said the model wasn't available — the LLM provider had returned an error.

This kept happening. Sometimes it was the LLM timing out. Sometimes it was the Google API calls failing — `gog`, the CLI tool Dylan uses to talk to Google, would just hang for 30 seconds and give up. Dylan, being a diligent agent, would respond to these failures by increasing the timeout on the cron job. But things would keep timing out regardless. I had to increase the timeout at least three times, and it still didn't make the problems go away.

The failure rate settled at around 26%. More than one in four mornings, my brief just wouldn't show up. And because the entire pipeline ran as a single cron job, a failure at any step — fetching the calendar, fetching email, calling the LLM, sending the Telegram message — meant all the work from previous steps was lost. If the LLM call succeeded but Telegram was briefly down, the whole thing had to restart from scratch.

I tried to explain to Dylan that he needed to handle retries more carefully, but the fundamental architecture was wrong. A cron job that shells out to a series of commands and hopes they all succeed in sequence is not a reliable system. No amount of timeout tuning changes that.

## Using Temporal to add reliability

I work at [Temporal](temporal.io). I write and maintain the documentation for a platform whose entire purpose is making exactly this kind of workflow reliable. And yet it took me weeks to reach for it, because I kept thinking: this is a five-step shell script, it's too simple to need Temporal.

Well, turns out it's not. 

The fix was straightforward. I created a small TypeScript project — [Durable Brief](https://github.com/lennessyy/durable-brief) — that wraps each step of the morning brief pipeline as a Temporal Activity. Each Activity gets its own timeout and retry policy. The three data-fetching steps (calendar, email, USPS scans) run in parallel, so a slow Google API call doesn't block everything else. If the LLM fails after all the data is already collected, Temporal replays from the `generateBrief` step without refetching anything. If Telegram is down, it retries five times with exponential backoff before giving up.

```
morningBriefWorkflow
├── fetchCalendar()         — 30s timeout, 3 retries     ┐
├── fetchEmails()           — 30s timeout, 3 retries     ├── parallel
├── fetchUSPSMailScans()    — 45s timeout, 3 retries     ┘
├── generateBrief(data)     — 60s timeout, 3 retries
└── sendToTelegram(brief)   — 15s timeout, 5 retries
```

The Workflow definition is about 20 lines of code. The Activities are just the same external calls Dylan was already making — `gog` CLI commands, a `fetch` to the LLM API, another `fetch` to Telegram. I didn't have to rewrite anything. I just wrapped what already existed in Activities and let Temporal handle the rest.

The setup cost was close to zero. Temporal is open source, and the Temporal CLI ships with a complete development server — one command (`temporal server start-dev`) and you have a fully functional Temporal Service running locally. The server and the Worker both run on the same NUC alongside OpenClaw. There's no cloud dependency, no infrastructure to provision, no cost. If you have a machine that can run your agent, it can run Temporal too.

Dylan's cron job now triggers the Temporal Workflow instead of running commands directly. He doesn't need to know or care about retries — the Workflow handles it all and returns the finished brief.

Since switching, the brief has been delivered every single morning. Watching the Temporal Web UI, I can see that retries fire regularly — Google API calls still flake out, the LLM still occasionally takes too long. But now those failures are invisible to me. They get retried automatically, and by 8:31 my brief is on my phone.

<figure>
  <img src="/images/durable-briefs-event-history.png" alt="Screenshot of the durable brief workflow retrying its activities and completing the execution" />
  <figcaption>The Temporal Web UI showing a completed Workflow Execution with retried Activities.</figcaption>
</figure>

## Takeaways

This little splunk I took hacking away at OpenClaw was the most fun I've had working on personal projects in a very long time. Here is what I learned:

**Agents are still limited, but look hard enough and you'll find value.** I almost gave up on Dylan. The morning brief with its lunch check and USPS mail scans isn't going to change my life, but it genuinely makes my mornings a little better. Sometimes that's enough to justify the experiment.

**Nothing is too simple to need reliability.** Five API calls in sequence will fail constantly when the APIs are free-tier and the network is a home NUC under a bed. I kept thinking the problem was timeouts and the fix was longer timeouts. The problem was that I had no retry or replay semantics at all.

**Temporal doesn't have to be hard.** The entire project is four TypeScript files. The Workflow is 20 lines. I vibe-coded the Workflow and Activity definitions with Claude in about 20 minutes, with very minimal changes on my part. Then I had Claude write an `AGENT.md` file explaining how to wire it up, handed the repo to Dylan, and he one-shot the integration with no additional input from me. (Dylan runs on MiniMax M2.5, for what it's worth.) Most of the value comes from Temporal's retry and replay guarantees, which you get just by defining Activities with timeout and retry policies. If your agent — or any pipeline — calls external services, this is the lowest-effort way I've found to make it stop failing.

Anyway, if you are experiencing the same issues with your agent, try adding durable execution -- I'd love to know how it works out for you (and on the off chance you read the docs and not your agent, let me know if you have any feedback as well). Lastly, if you've found a use case for OpenClaw that's actually stuck, however small, let me know too! I'd love to hear about it.