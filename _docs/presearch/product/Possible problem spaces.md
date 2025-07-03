# 1. Organizing a folder of messy files

The mvp would focus on `.pdf` files eg., as produced by a document scanner or downloaded via email. These often have uninformative names (like `scan0001.pdf`) but contain information within themselves sufficient to give them informative names and put them into a more organized folder system. _In my life, I have important documents of my own, documents belonging to my wife, documents belonging to my parents or in-laws, etc. that I scan and track. It would be great to automatically give new scans informative file names and mention who they pertain to with in-name tags like `[owner]`._ The ideal solution runs in the background, always, and does this automatically with menu tray controls and notifications. It might be acceptable to have a cli or Electron GUI, though. GUI would provide a nice way to track the progress and change the settings that isn't just a terminal.

A solution to this problem could naturally extend itself to more agents that understand other file types and can organize them as well (eg., messy screenshots folder with names like `Screenshot 2025-07-01 at 01.43.55.png`).

It could even be extended do some of the work of the proposed Obsidian plugin, since Obsidian notes are just plain `.md` files in folders.

If launched as an actual product to other users, it would be natural to add comprehensive features for particular file types with new context-specific agents over time.

## Existing solutions
[Perplexity search](https://www.perplexity.ai/search/what-are-the-best-tools-for-au-y2pqOITARKq8EHDBxadSxw)

- [AI File Pro](https://appsource.microsoft.com/en-us/product/web-apps/fabsoft1586798222622.ai_file_pro)
	- claimed features
		- content-based file and folder organization
	- limitations
		- $1,295 per user for a 1-year license
- [Hazel](https://www.noodlesoft.com/manual/hazel/hazel-overview/)
	- claimed features
		- extensive rule-based system for automatically organizing folders on macOS
	- limitations
		- rule-based
		- no OCR for PDFs
- [Docupile](https://www.docupile.com/ai-document-organizer-folder/)
	- claimed features
		- automatically organizes folders based on OCR and examination of the contents
		- [demo](https://www.youtube.com/watch?v=2vUqaBQirHg&t=81s)
	- limitations
		- it's a paid platform that involves uploading items to the web rather than running locally
		- has a very corporate/HR-flavored organization scheme that might not be ideal for personal use
- [Orgafile](https://orgafile.com/?via=topaitools)
	- claimed features
		- organize everything
	- limitations
		- upload-based again
		- paid SaaS
- [Sparkle](https://makeitsparkle.co/)
	- claimed features
		- "organizes any folder you choose"
	- limitations
		- does organization only based on filenames so is useless in my first two problem spaces
		- does not appear to rename files themselves
		- predefined folder scheme might not be the same as the one I prefer

# 2. Novel writing assistant inside Obsidian

_I participate in a writing group with some other newbie/aspiring writers. In project 1, I started building a writing tool with the kinds of features I would want (or others in my group suggested)._ It would be much nicer to hook those features into Obsidian, which already has a performant, local-first multi-platform editor, than it would be to continue build a whole editor and its AI features from scratch (or from the project 1 web app).

Proposed AI features:
- genre conventions guidance
- automatic ABCDE feedback
	- Awesome, Boring, Confusing, Didn't Believe, Excited
- automatic plot analysis (view adherence to or divergence from conventions, identify holes)
- automatic cover and blurb generation
- track character arcs/bios
- analyze dialogue and suggest how to make each character's voice consistent and unique
- chat with characters to ask them what they'd do in certain situations
- pacing analysis
- exposition vs. dialogue breakdown
- visualize scenes, chapters, characters, etc.
- fantasy features:
	- map generation
	- language generator
- recommend similar works or factual readings for background research relevant to your concepts

## Why not pursue this one?

I sort of already started building it in project 1, and it'd be good to have variety. I think I also want enough (robust) features, eventually, that this is better built on a longer timeline.

# 3. Bookmarks/web links organizer

_Often I save web links to various things across three areas: my browser, [Anybox](https://anybox.app/), and Obsidian. This pile of potential insights, action items, etc. quickly grows unwieldy and doesn't end up being super useful._

It would be possible to leverage AI agents to automate a smarter solution to this problem. The problem, however, **starts at the browser** on any of my devices, so the first task is to have an **extension for every platform I use** that captures the bookmark in the first place.

Anybox and Obsidian already provide such extensions for capture. [Obsidian Web Clipper](https://obsidian.md/clipper) produces plain markdown files in an Obsidian vault and [supports iOS](https://apps.apple.com/us/app/obsidian-web-clipper/id6720708363?platform=iphone), so it would be easiest to process, suggesting a smart web links organizer would take the form of an Obsidian plugin. I would also need to change my behavior to using Obsidian to save all of my links, which seems like a good idea for longevity and organization.

## Existing solutions

- [Obsidian Web Clipper](https://obsidian.md/clipper) itself
	- claimed features
		- Clip anything: From news articles and blog posts to recipes, product pages, and research papers — if it's on the web, you can save it.
		- Select page content: Clip entire pages, selected text, or let the clipper intelligently extract just the main content.
		- Customizable templates: Create tailored templates to automatically extract metadata from web pages. Perfect for academics, movie buffs, book lovers, or anyone who wants structured notes.
		- Smart triggers: Set up rules to automatically apply the right template based on the website you're clipping from.
		- Seamless integration: all your clips flow directly into Obsidian, in the vault and folder of your choice.
	- limitations
		- not ai, requires manual configuration of rules and templates
- [Anybox](https://anybox.app/)
	- claimed features
		- save, capture, and tag links from anywhere
		- integration with mobile apps where links are sometimes hard to extract
	- limitations
		- not ai, requires manual organization

## Why not pursue this one?

By combining Obsidian Web Clipper with other plugins like Note Companion or AI Tagger Universe mentioned below, I could likely build a better workflow using existing tools.

# 4. Tagging, organizing, summarizing, or extracting entities from notes

As I use Obsidian to take notes, a solution would naturally take the form of an Obsidian plugin. That would provide some UI and settings/configuration options within Obsidian, as well as support local or remote LLMs for backend processes. _In my life, I find my Obsidian notes tend toward disorder over time. It would be useful to automatically organize them eg., by moving them into more appropriate folders and/or maintaining an informative set of tags and yaml frontmatter (metadata)._

Another useful feature would be automatic named entity extraction—eg., if I type a person's name in my notes, the plugin would provide a convenient way to see all mentions and information about that person without my having to explicitly make a `[[Person]]` note.

## Existing solutions

- [Note Companion](https://github.com/different-ai/note-companion)
	- claimed features
		- 🗂️ **Organizing Suggestions**: Get AI-driven suggestions for folders, tags, filenames, and more.
		- 🎛️ **Custom Format AI Prompts**: Save and apply your own AI prompts for consistency.
		- 📁 **Automated Workflows**: Streamline your file management and formatting tasks.
		- 📖 **Handwritten Note Digitization**: Convert handwritten notes into searchable digital text.
		- 🔊 **Audio Transcription**: Easily transcribe and organize audio files.
		- ✂️ **Atomic Note Generation**: Break down larger notes into smaller, more focused ones.
		- 🎥 **YouTube Summaries**: Quickly generate summaries for YouTube videos.
		- 💬 **Context-Aware AI Chat**: Use AI to chat with multiple notes in context.
	- limitations
		- unclear...
- [AI Tagger Universe](https://github.com/niehu2018/obsidian-ai-tagger-universe)
	- claimed features
		- 🤖 Flexible AI Integration
			- **Use your preferred AI service**:
				- **Local LLMs**: Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint
			    - **Cloud Services**: OpenAI, Claude, Gemini, Groq, Grok, Mistral, DeepSeek, Cohere, SiliconFlow, Aliyun, Bedrock, Vertex AI, OpenRouter, and more
		- 🏷️ Smart Tagging System
			- **Multiple tagging modes**:
			    - Generate completely new tags based on content
			    - Match against your existing vault tags
			    - Use predefined tags from a custom list
			    - Hybrid modes combining generation with existing/predefined tags
			- **Batch operations** for tagging multiple notes at once
			- **Multilingual support** for generating tags in your preferred language
		- 📊 Tag Network Visualization
			- Interactive graph showing relationships between tags
			- Discover connections and patterns in your knowledge base
			- Search functionality to find specific tags
			- Node size indicates tag frequency
		- 🛠️ Advanced Management
			- Generate tags from selected text portions
			- Batch tag entire folders or your whole vault
			- Clear tags while preserving other frontmatter
			- Collect and export all tags from your vault
	- limitations
		- focused only the tags subset of my identified problems, but appears to nail it
- [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections)
	- claimed features
		- ✔️ Zero-setup: Local AI models for embeddings
		- 🔐 Private & offline by default
		- 📲 Works on mobile devices
		- 🤖 Supports 1000s of Local & API models
		- 🤖 Local models via Ollama, LM Studio & HuggingFace transformers.js
		- 📁 Simple local data files
		- 📄 **PDFs support in Smart  Chat** – drag research papers straight into the conversation
		- 📦 Ultra-lightweight bundle (~1 MB) with minimal/no third-party dependencies
		- 🔍 Streamlined codebase with minimal/no dependencies can be audited >3× faster than comparable AI plugins
		- 🌐 Open-source
		- ⚔️ Mission-driven, user-aligned, community-supported
	- limitations
		- not very focused on organization itself... more the idea that its own connections obviate the need for better organization
- [ChatGPT MD](https://github.com/bramses/chatgpt-md)
	- claimed features
		- **Interactive conversations**:
		    - Engage directly with ChatGPT, OpenRouter.ai models, and Ollama from any Markdown note, edit questions or responses on-the-fly, and continue the chat seamlessly.
		- **Privacy & Zero API Costs:**
		    - Use local LLMs via Ollama, keeping your chats on your computer and avoiding API costs.
		- **Web Access Models:**
		    - Get real-time information from the web with OpenAI's `gpt-4o-search-preview` and Perplexity's `openrouter@perplexity/llama-3.1-sonar-small-128k-online` (via openrouter.ai).
		- **Multiple AI Providers:**
		    - Choose from OpenAI, OpenRouter.ai (with access to models like Gemini, Claude, DeepSeek, Llama, Perplexity), or local models via Ollama.
		- **System Commands:**
		    - Instruct the LLM via system commands to get the best possible answers.
		- **Link context**:
		    - Provide links to any other note in your vault for added context during conversations with Markdown or Wiki links.
		- **Per-note Configuration:**
		    - Overwrite default settings via frontmatter for individual notes using params from [OpenAI API](https://platform.openai.com/docs/api-reference/chat), [OpenRouter.ai](https://openrouter.ai/docs), or [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion).
		- **Markdown Support:**
		    - Enjoy full rendering of lists, code blocks, and more from all responses.
		- **Minimal Setup:**
		    - Utilize your OpenAI API key, OpenRouter.ai API key, or install any LLM locally via Ollama.
		- **Comment Blocks:**
		    - Ignore parts of your notes using comment blocks.
		- **Chat Templates**:
		    - Use and share frontmatter templates for recurring scenarios. Explore [chatgpt-md-templates](https://github.com/bramses/chatgpt-md-templates).
	- limitations
		- more of a chat assistant than an automated background worker
		- doesn't automatically understand the full context of your notes
		- isn't really seeking to address the same problems

## Why not pursue this one?

Note Companion and AI Tagger Universe already look like a good existing solutions to this problem and can be used together. I am not sure what I would want to add without extensive use that will not occur in the next three days.

[Even more prior art | Perplexity](https://www.perplexity.ai/search/what-are-the-best-obsidian-ai-VxzEo9gFTmqBVHeWWoZrkw#0)
# 5. Shopping assistant

_I often spend time research "what's the best X" and comparing candidates across some dimensions before buying it. It is possible a better tool could be built to assist with this._

Features would include:
- look for reviews
- organize the candidates for "best of x"
- summarize pros and cons in a neat table sortable by priority trade-off

## Existing solutions

- Perplexity, and basically every leading AI tool

## Why not pursue this one?

I am doubtful I can build something better than Perplexity already is at this task in the given time and resource constraints.
