---
title: "Kubernetes backup and restore done right"
description: "Why Infrastructure-as-Code isn't enough, and how to build a real backup strategy for your Kubernetes clusters."
pubDate: 2024-11-26
tags: ["kubernetes", "devops", "backup"]
---

*Originally published on [spectrocloud.com/blog](https://www.spectrocloud.com/blog/kubernetes-backup-and-restore-done-right).*

---

Picture this: you're a DevOps engineer having a normal Tuesday when alerts start flooding in. The control plane of a production Kubernetes cluster has failed. Slack channels light up. Meetings get scheduled. Panic sets in.

In moments like these, backups are your only lifeline.

In this post, I'll explore why Kubernetes backups matter, what backup solutions are available, best practices for protecting your clusters, and how Palette addresses cluster protection.

## Why backup if you can use infrastructure-as-code?

Infrastructure-as-Code enables quick cluster recreation, but that alone is not enough. IaC doesn't restore the data in your cluster, nor is it likely to return your cluster to a fully functional state.

Even clusters you think of as ephemeral often have stateful dependencies. Consider an order-processing application with a database: IaC recreates the infrastructure, but customer order data stored in the database is gone. Runtime-generated annotations, labels, and dynamic configurations won't be there either. External service connections — messaging queues, third-party integrations — won't automatically reconnect to a rebuilt cluster.

Restoring all of that manually takes extensive effort. Backups save you from that pain.

## Kubernetes backup solutions

There are two primary types of Kubernetes backups:

### Etcd backups

Etcd is the distributed key-value database that stores cluster state, configurations, secrets, and API objects. Backing up etcd gives you a snapshot of the cluster's brain. Lighter Kubernetes distributions like K3s use alternative databases, but the concept is the same. Managed services like Amazon EKS typically handle etcd backups automatically.

### Full cluster backups

Full cluster backups capture all Kubernetes objects and persistent volumes, typically producing JSON files representing cluster resources alongside volume snapshots. These are performed by tools specifically designed for Kubernetes.

### How they compare

| Aspect | Etcd Backup | Full Cluster Backup |
|---|---|---|
| **Scope** | Cluster state and configuration | All resources including persistent volumes |
| **Use case** | Restoring corrupted or lost etcd | Migration between clusters; disaster recovery |
| **Restoration target** | Typically same cluster | Same or different cluster |
| **File size** | Megabytes to low gigabytes | High gigabytes depending on data |
| **Speed** | Rarely exceeds 10 minutes | More time-consuming |

Etcd backups are smaller, faster, and cheaper, but typically restore only the failed cluster in place. Full cluster backups enable both disaster recovery and migration scenarios.

## Kubernetes backup best practices

Standard backup practices apply — schedule backups, optimize retention policies, back up to multiple locations, test backups, and encrypt backup data. Here are some Kubernetes-specific strategies:

**Backup frequency.** Perform etcd backups daily on production clusters. Schedule less-frequent full cluster backups (weekly) to reduce compute and storage costs.

**Backup granularity.** Skip backing up objects easily recreated with IaC. For example, back up database and API layers but not frontend layers that can be rapidly reconstructed. This reduces storage costs and improves performance.

**Backup locations.** Store copies in multiple geographically distributed locations — perhaps a primary cloud region, a secondary region, and a separate cloud provider or on-premises storage. This protects against localized failures.

**Backup testing.** Regularly test backups in non-production environments. Weekly restoration tests help ensure viability. Cluster changes may impact whether your backup configurations still work as expected.

## Kubernetes backup tools

When evaluating tools, look for support for full cluster backups, scheduled backups, Kubernetes environment integration, granular namespace and label-based backups, and backup testing capabilities.

**Commercial options** include Kasten K10, CloudCasa, and Portworx Enterprise. These provide application-centric approaches, grouping related resources for cohesive restoration.

**Velero** is the leading free open-source option. It offers multi-cloud support, full cluster scheduled backups, and namespace and label granularity. The tradeoff is that it requires manual resource grouping via namespaces and labels, and your team takes on the administration burden.

## Conclusion

Creating a backup strategy requires evaluating your cluster workload needs and organizational requirements. Invest in disaster recovery infrastructure upfront — before you need it.

Backups aren't just about recovery — they're about resilience and confidence.
