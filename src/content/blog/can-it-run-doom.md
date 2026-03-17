---
title: "Can it run Doom? Palette is your BFG for secure edge Kubernetes apps"
description: "Deploying the classic 1993 FPS on Kubernetes edge devices with Palette, and learning about pod security along the way."
pubDate: 2024-06-18
tags: ["kubernetes", "edge", "palette"]
---

*Originally published on [spectrocloud.com/blog](https://www.spectrocloud.com/blog/can-it-run-doom-palette-is-your-bfg).*

---

"Can it run Doom?" — the question that has haunted every piece of hardware since 1993. In this post, I set out to answer it for Kubernetes edge devices managed by Palette, and along the way discovered some real lessons about pod security, cluster profiles, and deploying workloads at the edge.

## What is Doom?

Doom is a first-person shooter released by id Software in 1993. You play as a Marine fighting demons at a Mars research facility. The game was open-sourced in 1997, which kicked off an internet phenomenon: people trying to run Doom on anything with a processor — calculators, ATMs, pregnancy tests, you name it.

So naturally, I had to try running it on a Kubernetes cluster.

## The challenges

I identified three main hurdles:

- Finding a containerized version of Doom
- Abstracting the deployment into a Palette Cluster Profile
- Exposing the application on the local network

## Step 1: Running Doom in a kind cluster

I discovered David Zuber's [kubedoom](https://github.com/storax/kubedoom) repository, which provides a containerized, Kubernetes-compatible version of the Doom shareware edition. Initial deployment on a local kind cluster succeeded without issues.

## Step 2: Bringing manifests into a Palette profile layer

Palette uses Cluster Profiles to specify the desired state of a cluster through Helm charts or Kubernetes manifests. This approach enables:

- Reusable configurations across multiple deployments
- Version control and iterative updates
- Simplified day-2 operations like patching and upgrading

I converted the kubedoom manifests into an add-on profile layer in about 20 seconds. The beauty of Cluster Profiles is declarative deployment and management — define once, deploy anywhere.

## Step 3: Provisioning with Palette

Deployment to an AWS cluster initially failed due to pod security violations:

> "violates PodSecurity baseline:v1.28: host namespaces (hostNetwork=true), hostPort"

**Root cause:** Kubernetes v1.25 introduced the Pod Security Admission Controller with `baseline` as the default security standard, replacing older Pod Security Policies. My kind cluster used v1.23.0, which lacked these enforcement mechanisms, while the AWS cluster ran v1.29.0.

As a temporary workaround, I added namespace labels to allow privileged workloads:

```yaml
pack:
  namespace: "kubedoom"
  namespaceLabels:
    "kubedoom": "pod-security.kubernetes.io/enforce=privileged,pod-security.kubernetes.io/enforce-version=v1.29"
```

After this adjustment, deployment succeeded on both AWS and the edge NUC device. The edge deployment leveraged Palette's EdgeForge workflow for custom OS and Kubernetes distribution configuration.

## Step 4: Making Doom more secure

Rather than accepting the privileged security standard, I addressed the root cause to comply with baseline standards. The problematic configuration was `hostNetwork: true`, which exposed the host network to potential security risks.

**Solution:** Remove `hostNetwork: true` and replace it with a NodePort service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kubedoom-service
  namespace: kubedoom
spec:
  type: NodePort
  selector:
    app: kubedoom
  ports:
    - port: 5900
      targetPort: 5900
      nodePort: 30059
```

This exposes the service on port 30059 across all cluster nodes while maintaining pod security compliance. No more privileged namespace needed.

## Key takeaways

While this project was lighthearted, it demonstrates authentic deployment workflows applicable to mission-critical applications:

- **Cluster Profiles** enable scalable, consistent workload deployment across heterogeneous infrastructure
- **Pod security standards** evolved significantly in Kubernetes v1.25+ — you can't ignore them
- **Proper service exposure** strategies can replace privileged namespace access
- **Edge deployment** via Palette maintains full functionality, even when disconnected from the management plane

So yes — it can run Doom. And securely, at that.
