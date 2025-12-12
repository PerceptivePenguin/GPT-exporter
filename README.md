# GPT Exporter

A browser extension for exporting ChatGPT conversations to Markdown and generating AI-powered summaries. Supports Chrome, Edge, and Firefox.

## Description

GPT Exporter adds export and navigation capabilities to ChatGPT. It parses conversation threads directly from the page, groups messages into Q&A pairs, and exports them as clean Markdown documents. The extension also supports generating conversation summaries using external LLM providers.

Works on:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox

## Installation

### Chrome / Edge

1. Go to the [Releases](../../releases) page
2. Download the `.zip` file for Chrome/Edge
3. Extract the downloaded file
4. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the extracted folder

### Firefox

1. Go to the [Releases](../../releases) page
2. Download the `.xpi` file for Firefox
3. Open Firefox and go to `about:addons`
4. Click the gear icon and select "Install Add-on From File..."
5. Select the downloaded `.xpi` file

## Usage

### Exporting Conversations

1. Open any ChatGPT conversation
2. Click the **"Export MD"** button in the bottom-right corner
3. Wait for the extension to scan the conversation
4. In the selection modal:
   - Check/uncheck Q&A pairs to include
   - Use "Select All" or "Clear" for bulk selection
5. Click **"Export Selected"**
6. Enter a filename (or accept the default)
7. The Markdown file downloads automatically

### Navigating Questions

1. Click the **"Questions"** button above the export button
2. A panel opens showing all questions in the conversation
3. Click any question to scroll to its location
4. Click the **X** button to close the panel

### Generating Summaries

1. Configure an LLM provider in the extension popup:
   - Click the extension icon in your browser toolbar
   - Select a provider (OpenAI, Anthropic, Gemini, or Custom)
   - Enter your API key and preferred model
   - Click **"Save"**
2. Open a ChatGPT conversation
3. Click **"Export MD"** and select Q&A pairs
4. Click **"Summarize Selected"**
5. Enter a filename for the summary
6. The summary generates and downloads as Markdown

### Customizing Summary Prompts

1. Open the extension popup
2. Click the prompt icon (chat bubble with gear) in the header
3. Edit the template text
4. Click **"Save"** to apply changes

## License

MIT License