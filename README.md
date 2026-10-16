# ⚡ Scriptless Automation Studio: Codeless Automation Framework

**Scriptless Automation Studio** is an enterprise-grade, codeless test automation platform engineered with a scriptless visual workflow builder powered by **Playwright** and **Express.js**. 

Designed for scalability, ease of use, and maximum execution stability, AutoFlow Studio features **dynamic self-healing locators**, **custom asynchronous synchronization (`waitLoop`)**, **native file upload handling**, and **smooth auto-scrolling** for complex modern web applications and legacy JSP pages.

---

## ✨ Key Features

* 🎨 **Scriptless UI Studio**: Visual drag-and-drop workflow canvas for creating, updating, and reordering test steps visually without writing code.
* 🛡️ **Multi-Tiered Self-Healing Engine**: Fallback locators dynamically iterate through CSS, XPath, ID, and text selectors to auto-recover from DOM changes.
* 📁 **Smart File Upload Interception**: Uses direct DOM injection (`setInputFiles()`) and Playwright `filechooser` event listeners to bypass native OS file picker dialogs seamlessly.
* ⏱️ **Custom Wait Loop (`waitLoop`)**: Configurable synchronization node that introduces user-specified pauses followed by multi-attempt component polling to handle long background processes and progress spinners.
* 📜 **Smooth Auto-Scroll Interaction**: Automatically scrolls elements into view before executing actions to prevent failure from sticky headers or floating overlays.
* 📑 **Chrome Recorder JSON Import**: Ingests standard Chrome DevTools Recorder recordings and converts them automatically into executable visual test steps.

---

## 🏗️ Tech Stack & Architecture

* **Frontend**: HTML5, Tailwind CSS, Native Drag & Drop API
* **Backend Runtime**: Node.js & Express.js (TypeScript)
* **Automation Engine**: Playwright (Chromium)
* **Workflow Manager**: In-Memory & REST API JSON State Sync

---

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v16.x or later)
* `npm` (comes bundled with Node.js)
* [Git](https://git-scm.com/)

---