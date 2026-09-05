<div align="center">

<img src="logo.png" alt="PayNexa Logo" width="180"/>

# 💳 PayNexa

## 🤖 AI Revenue Recovery Platform

### Detect • Score • Recommend • Recover • Communicate • Verify • Audit

<p>
AI-assisted payment revenue recovery platform designed to identify
recoverable payment failures, recommend bounded recovery strategies,
and provide measurable and auditable recovery workflows.
</p>

<br>

![Razorpay AI Buildathon](https://img.shields.io/badge/Razorpay-AI%20Buildathon%202026-blue)
![AI Revenue Recovery](https://img.shields.io/badge/Track-AI%20Revenue%20Recovery-blue)
![Status](https://img.shields.io/badge/Status-Demo%20Prototype-success)
![Mode](https://img.shields.io/badge/Payment%20Mode-Simulation-orange)

</div>

---

# 📌 Table of Contents

- [🚀 Overview](#-overview)
- [🎯 Problem Statement](#-problem-statement)
- [💡 Our Solution](#-our-solution)
- [🔄 How PayNexa Works](#-how-paynexa-works)
- [⚙️ Core Workflow](#-core-workflow)
- [✨ Key Features](#-key-features)
- [🤖 AI & Recovery Intelligence](#-ai--recovery-intelligence)
- [🛡️ Policy Guardrails](#-policy-guardrails)
- [🔄 Recovery Actions](#-recovery-actions)
- [💬 Customer Communications](#-customer-communications)
- [🧾 Offline Payment Verification](#-offline-payment-verification)
- [🧪 Experiments & Evaluation](#-experiments--evaluation)
- [🔐 Audit Trail](#-audit-trail)
- [🏗️ System Architecture](#-system-architecture)
- [🧰 Technology Stack](#-technology-stack)
- [📈 Demo Metrics](#-demo-metrics)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🎥 Demo Flow](#-demo-flow)
- [🔒 Security & Safety](#-security--safety)
- [⚠️ Limitations](#-limitations)
- [🔮 Future Scope](#-future-scope)
- [🏆 Buildathon Context](#-buildathon-context)
- [👩‍💻 Team](#-team)
- [🌐 Project Links](#-project-links)
- [⚠️ Disclaimer](#-disclaimer)

---

# 🚀 Overview

**PayNexa** is an AI-assisted revenue recovery platform designed to
help merchants identify and recover revenue associated with failed
or interrupted payment events.

Instead of treating every failed payment equally, PayNexa analyzes
the payment context, estimates recoverability, prioritizes recovery
cases, recommends an appropriate intervention, and validates that
intervention through deterministic policy guardrails.

The complete recovery lifecycle is:

> **Detect → Score → Recommend → Guardrail → Recover → Communicate → Verify → Audit**

The core principle behind PayNexa is:

> 🧠 **AI recommends. Deterministic policies decide what is allowed.
> The recovery workflow executes within defined boundaries.**

---

# 🎯 Problem Statement

Payment failures do not always represent permanently lost revenue.

A failed payment may result from:

- 🌐 Temporary network issues
- 🏦 Bank or gateway latency
- 💳 Authentication failures
- 📱 Payment-method-specific failures
- 💰 Insufficient funds
- ⏱️ Timing-related payment abandonment
- 🔄 Retry-related issues

Merchants therefore need to determine:

1. Which failed payments are recoverable?
2. Which intervention should be attempted?
3. When should the intervention happen?
4. When should automated recovery stop?
5. When should a human take over?
6. How much revenue was recovered?
7. Can the complete decision lifecycle be audited?

PayNexa addresses these questions through an AI-assisted,
policy-controlled recovery workflow.

---

# 💡 Our Solution

PayNexa transforms failed payment events into actionable
recovery cases.

### 🔎 Detect

Identify failed or at-risk payment events.

### 📊 Score

Estimate the probability that a payment can be recovered.

### 🤖 Recommend

Use AI-assisted reasoning to recommend a suitable recovery strategy.

### 🛡️ Guardrail

Validate the recommendation against deterministic business rules.

### 🔄 Recover

Execute a bounded recovery workflow in the simulation environment.

### 💬 Communicate

Generate appropriate customer recovery communication.

### 🧾 Verify

Support merchant verification of offline/manual payment cases.

### 🔐 Audit

Record important decisions and actions for traceability.

---

# 🔄 How PayNexa Works

```text
                    PAYMENT EVENT
                          │
                          ▼
                 🔎 FAILURE DETECTION
                          │
                          ▼
                 📊 RECOVERY SCORING
                          │
                          ▼
                 🤖 AI RECOMMENDATION
                          │
                          ▼
                 🛡️ POLICY ENGINE
                          │
                    ┌─────┴─────┐
                    │           │
                    ▼           ▼
                 APPROVED     BLOCKED
                    │           │
                    ▼           ▼
              🔄 RECOVERY    👤 HUMAN
                 ACTION       REVIEW
                    │
                    ▼
             SIMULATED OUTCOME
                    │
             ┌──────┼──────┐
             ▼      ▼      ▼
         📊 DASHBOARD 💬 COMMS 🔐 AUDIT
                    │
                    ▼
              🧪 EXPERIMENTS
                    │
                    ▼
            📈 MEASURED IMPACTpayment debits are performed.
