const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class AIDocumentationHandler {
    constructor() {
        this.knowledgeBase = null;
        this.loadKnowledgeBase();
    }

    // Load project documentation knowledge base
    async loadKnowledgeBase() {
        try {
            const kbPath = path.join(__dirname, '../../data/knowledge-base.json');
            if (await fs.pathExists(kbPath)) {
                this.knowledgeBase = await fs.readJson(kbPath);
            } else {
                // Create default knowledge base
                this.knowledgeBase = {
                    project: {
                        name: process.env.PROJECT_NAME || 'HyprL',
                        description: 'A modern, fast, and customizable window manager for Linux',
                        repository: process.env.PROJECT_URL || 'https://github.com/Manpeet113/hyprL',
                        documentation: process.env.DOCS_URL || 'https://hyprl-docs.vercel.app'
                    },
                    topics: {
                        'installation': {
                            keywords: ['install', 'setup', 'build', 'compile', 'dependencies'],
                            content: 'To install HyprL, you can either build from source or use a package manager. Check the installation guide in our documentation for detailed steps.'
                        },
                        'configuration': {
                            keywords: ['config', 'settings', 'customize', 'keybinds', 'rules'],
                            content: 'HyprL uses a configuration file located at ~/.config/hyprl/hyprl.conf. You can customize keybindings, window rules, animations, and more.'
                        },
                        'troubleshooting': {
                            keywords: ['error', 'crash', 'bug', 'fix', 'problem', 'issue'],
                            content: 'Common issues include graphics driver problems, configuration syntax errors, and missing dependencies. Check our troubleshooting guide for solutions.'
                        },
                        'features': {
                            keywords: ['features', 'capabilities', 'what can', 'supports'],
                            content: 'HyprL supports dynamic tiling, animations, multiple monitors, workspaces, window rules, plugins, and much more. It\'s designed for performance and customization.'
                        },
                        'keybindings': {
                            keywords: ['shortcuts', 'keys', 'binds', 'hotkeys', 'controls'],
                            content: 'Default keybindings include Super+Enter for terminal, Super+Q to close windows, Super+number for workspaces. All keybindings are fully customizable.'
                        }
                    }
                };
                await this.saveKnowledgeBase();
            }
        } catch (error) {
            console.error('Error loading knowledge base:', error);
            this.knowledgeBase = { project: {}, topics: {} };
        }
    }

    // Save knowledge base to file
    async saveKnowledgeBase() {
        try {
            const kbPath = path.join(__dirname, '../../data/knowledge-base.json');
            await fs.writeJson(kbPath, this.knowledgeBase, { spaces: 2 });
        } catch (error) {
            console.error('Error saving knowledge base:', error);
        }
    }

    // Find relevant topics based on user query
    findRelevantTopics(query) {
        const queryLower = query.toLowerCase();
        const relevantTopics = [];

        for (const [topicName, topicData] of Object.entries(this.knowledgeBase.topics)) {
            const relevance = topicData.keywords.some(keyword => 
                queryLower.includes(keyword.toLowerCase())
            );
            
            if (relevance) {
                relevantTopics.push({
                    name: topicName,
                    content: topicData.content,
                    keywords: topicData.keywords
                });
            }
        }

        return relevantTopics;
    }

    // Use free AI API (Hugging Face Inference API)
    async queryHuggingFaceAI(prompt) {
        try {
            const response = await axios.post(
                'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
                { inputs: prompt },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return response.data.generated_text || response.data[0]?.generated_text || null;
        } catch (error) {
            console.error('Hugging Face API error:', error.message);
            return null;
        }
    }

    // Alternative free AI using OpenAI-compatible API (Together AI, etc.)
    async queryFreeAI(prompt) {
        // Try multiple free AI services
        const services = [
            {
                name: 'Hugging Face',
                fn: () => this.queryHuggingFaceAI(prompt)
            }
        ];

        for (const service of services) {
            try {
                const result = await service.fn();
                if (result) {
                    return result;
                }
            } catch (error) {
                console.log(`${service.name} failed, trying next...`);
            }
        }

        return null;
    }

    // Generate AI response for documentation query
    async generateResponse(userQuery) {
        try {
            // First, find relevant topics from knowledge base
            const relevantTopics = this.findRelevantTopics(userQuery);
            
            let context = `Project: ${this.knowledgeBase.project.name}\\n`;
            context += `Description: ${this.knowledgeBase.project.description}\\n\\n`;
            
            if (relevantTopics.length > 0) {
                context += 'Relevant information:\\n';
                relevantTopics.forEach(topic => {
                    context += `- ${topic.name}: ${topic.content}\\n`;
                });
            }

            // Create AI prompt
            const prompt = `${context}\\nUser Question: ${userQuery}\\nHelpful Answer:`;

            // Try AI service
            const aiResponse = await this.queryFreeAI(prompt);
            
            if (aiResponse) {
                return {
                    success: true,
                    response: aiResponse,
                    source: 'AI + Knowledge Base',
                    relevantTopics: relevantTopics
                };
            }

            // Fallback to knowledge base only
            if (relevantTopics.length > 0) {
                const response = relevantTopics.map(topic => topic.content).join('\\n\\n');
                return {
                    success: true,
                    response: response,
                    source: 'Knowledge Base',
                    relevantTopics: relevantTopics
                };
            }

            // Ultimate fallback
            return {
                success: false,
                response: `I don't have specific information about that topic. Please check our documentation at ${this.knowledgeBase.project.documentation} or ask in the support channels.`,
                source: 'Fallback',
                relevantTopics: []
            };

        } catch (error) {
            console.error('Error generating AI response:', error);
            return {
                success: false,
                response: 'Sorry, I encountered an error while processing your question. Please try again later.',
                source: 'Error',
                relevantTopics: []
            };
        }
    }

    // Update knowledge base with new information
    async updateKnowledgeBase(topic, keywords, content) {
        try {
            if (!this.knowledgeBase.topics[topic]) {
                this.knowledgeBase.topics[topic] = { keywords: [], content: '' };
            }
            
            this.knowledgeBase.topics[topic].keywords = [...new Set([...this.knowledgeBase.topics[topic].keywords, ...keywords])];
            this.knowledgeBase.topics[topic].content = content;
            
            await this.saveKnowledgeBase();
            return true;
        } catch (error) {
            console.error('Error updating knowledge base:', error);
            return false;
        }
    }
}

module.exports = new AIDocumentationHandler();
