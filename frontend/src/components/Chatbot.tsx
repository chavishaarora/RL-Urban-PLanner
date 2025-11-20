import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { ChatbotIcon, SendIcon, XIcon, Spinner } from './Icons';
import { Message, MapSource } from '../types';
// Chatbot enhancement imports
import { PERSONAS, DEFAULT_PERSONA } from '@/services/chatbot/personas';
import { initialSessionState, reduceSessionState, ChatEvent } from '@/services/chatbot/state';
import { detectIntent } from '@/services/chatbot/intents';
import { 
    getIntroStep, 
    getGoalSelectionStep, 
    getSiteAnalysisChecklist, 
    getConceptPlanningChecklist,
    getEnvironmentalMetricsChecklist,
    getAccessibilityMobilityChecklist,
    getComplianceReviewChecklist,
    getMarketCostChecklist,
    getExportReportChecklist,
    getLearnMetricsChecklist,
    getGrowthAnalysisChecklist,
    getEnvironmentalRiskChecklist,
    getPublicRealmChecklist,
    getRiskOpportunityChecklist,
    getPostAnalysisActions, 
    getFallbackStep, 
    ChecklistItem 
} from '@/services/chatbot/onboardingFlow';

const API_KEY = process.env.API_KEY;

interface ChatbotProps {
    analysisContext: string;
    messages: Message[];
    onMessagesChange: (messages: Message[]) => void;
}

export const Chatbot: React.FC<ChatbotProps> = ({ analysisContext, messages, onMessagesChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    // New state for persona & guided onboarding
    const [sessionState, setSessionState] = useState(initialSessionState);
    const [scriptSteps, setScriptSteps] = useState<any[]>([]);
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [userCoords, setUserCoords] = useState<{latitude: number, longitude: number} | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserCoords({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.warn("Could not get user location for chatbot, map queries may be less accurate.", err);
            }
        );
    }, []);

    // Initialize scripted onboarding steps on first open
    useEffect(() => {
        if (scriptSteps.length === 0) {
            setScriptSteps([getIntroStep()]);
        }
    }, [scriptSteps.length]);

    useEffect(() => {
        if (!API_KEY) return;
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const chatInstance = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are UrbanBuddy, an expert urban planning assistant. 
                Your primary knowledge is based on the provided analysis context of a specific site.
                When asked for up-to-date information about nearby places, directions, or current conditions, use your Google Maps tool to find the most relevant and current information.
                Always cite your map sources when you use the tool.
                Be helpful and concise.
                \n\nANALYSIS CONTEXT:\n${analysisContext}`,
                tools: [{googleMaps: {}}],
                ...(userCoords && {
                    toolConfig: {
                        retrievalConfig: {
                            latLng: userCoords
                        }
                    }
                })
            },
        });
        setChat(chatInstance);
    }, [analysisContext, userCoords]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const advance = (event: ChatEvent) => {
        setSessionState(prev => reduceSessionState(prev, event));
    };

    // Toggle checklist item completion
    const toggleChecklistItem = (itemId: string, action?: string) => {
        setChecklistItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
        ));
        // If there's an action, execute it
        if (action) {
            handleScriptAction(action);
        }
    };

    // Handle button actions from scripted steps
    const handleScriptAction = (action: string) => {
        if (action.startsWith('selectRole:')) {
            const personaKey = action.split(':')[1];
            advance({ type: 'SELECT_ROLE', persona: personaKey });
            setScriptSteps([getGoalSelectionStep(personaKey as any)]);
            return;
        }
        if (action.startsWith('selectGoal:')) {
            const goal = action.split(':')[1];
            advance({ type: 'SELECT_GOAL', goal });
            
            // Route to appropriate checklist based on goal
            let checklistStep;
            
            if (/site analysis/i.test(goal) || /run site analysis/i.test(goal)) {
                checklistStep = getSiteAnalysisChecklist((sessionState.persona as any) || DEFAULT_PERSONA.key);
            } else if (/concept planning/i.test(goal) || /try concept planner/i.test(goal)) {
                checklistStep = getConceptPlanningChecklist();
            } else if (/environmental.*metrics/i.test(goal)) {
                checklistStep = getEnvironmentalMetricsChecklist();
            } else if (/environmental.*risk/i.test(goal)) {
                checklistStep = getEnvironmentalRiskChecklist();
            } else if (/accessibility|mobility/i.test(goal)) {
                checklistStep = getAccessibilityMobilityChecklist();
            } else if (/compliance/i.test(goal)) {
                checklistStep = getComplianceReviewChecklist();
            } else if (/market.*cost/i.test(goal)) {
                checklistStep = getMarketCostChecklist();
            } else if (/risk.*opportunity/i.test(goal)) {
                checklistStep = getRiskOpportunityChecklist();
            } else if (/growth/i.test(goal)) {
                checklistStep = getGrowthAnalysisChecklist();
            } else if (/public.*realm/i.test(goal)) {
                checklistStep = getPublicRealmChecklist();
            } else if (/export|report|full report|compliance pack/i.test(goal)) {
                checklistStep = getExportReportChecklist();
            } else if (/learn.*metrics/i.test(goal)) {
                checklistStep = getLearnMetricsChecklist();
            } else {
                // Fallback for goals without specific checklists
                setScriptSteps([getFallbackStep()]);
                return;
            }
            
            setScriptSteps([checklistStep]);
            setChecklistItems(checklistStep.checklist || []);
            return;
        }
        
        // Navigation actions - guide users to different pages
        if (action === 'navigateToAnalysis') {
            window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'analysis' } }));
            setScriptSteps([{
                id: 'navigatedToAnalysis',
                message: 'Analysis page opened. Draw your site boundary using the map tools, then click "Analyze Site" when ready.',
                autoAdvance: true
            }]);
            return;
        }
        if (action === 'navigateToContextMaps') {
            window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'contextMaps' } }));
            setScriptSteps([{
                id: 'navigatedToContextMaps',
                message: 'Context maps opened. Explore the 8 analysis layers to understand your site context.',
                autoAdvance: true
            }]);
            return;
        }
        if (action === 'navigateToQuantitative') {
            window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'quantitative' } }));
            setScriptSteps([{
                id: 'navigatedToQuantitative',
                message: 'Quantitative metrics opened. Review the detailed KPIs and data for your site.',
                autoAdvance: true
            }]);
            return;
        }
        if (action === 'navigateToConceptPlanner') {
            window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { view: 'planner' } }));
            setScriptSteps([{
                id: 'navigatedToPlanner',
                message: 'Concept planner opened. Start designing your 2D/3D concept.',
                autoAdvance: true
            }]);
            return;
        }
        
        // Help and utility actions
        if (action === 'helpBoundary') {
            setScriptSteps([{
                id: 'helpBoundary',
                message: 'How to draw a site boundary:\n\n1. Click the "Draw Area" button on the map\n2. Click points around your site to create a polygon\n3. Double-click to finish\n4. Click "Analyze Site" when ready\n\nTip: Make sure your boundary fully encloses the area you want to analyze.',
                buttons: [{ label: 'Back', action: 'backToChecklist' }]
            }]);
            return;
        }
        if (action === 'backToChecklist') {
            const checklistStep = getSiteAnalysisChecklist((sessionState.persona as any) || DEFAULT_PERSONA.key);
            setScriptSteps([checklistStep]);
            setChecklistItems(checklistStep.checklist || []);
            return;
        }
        if (action === 'openChat') {
            // Clear script steps to enable free chat
            setScriptSteps([]);
            return;
        }
        if (action === 'saveProject') {
            // Trigger save project (will be wired to actual save button click)
            window.dispatchEvent(new CustomEvent('ue-navigate', { detail: { action: 'saveProject' } }));
            setScriptSteps([{
                id: 'projectSaved',
                message: 'Project saved successfully.',
                autoAdvance: true
            }]);
            return;
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading) return;

        const userMessage: Message = { role: 'user', text: input };
        const newMessages = [...messages, userMessage];
        onMessagesChange(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Intent detection before sending to model (quick path)
            const detected = detectIntent(userMessage.text);
            if (detected.intent !== 'unknown') {
                // Provide a scripted response rather than model call
                const scriptedReply: Message = {
                    role: 'model',
                    text: `Detected intent: ${detected.intent}. (Automation wiring coming next.)`
                };
                onMessagesChange([...newMessages, scriptedReply]);
                setIsLoading(false);
                return;
            }
            const response = await chat.sendMessage({ message: input });

            const modelResponseText = response.text;
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            const mapSources = groundingChunks
                .filter((chunk: any) => chunk.maps && chunk.maps.uri)
                .map((chunk: any) => chunk.maps as MapSource);

            const modelMessage: Message = {
                role: 'model',
                text: modelResponseText,
                sources: mapSources.length > 0 ? mapSources.map(ms => ({ maps: ms })) : undefined,
            };
            onMessagesChange([...newMessages, modelMessage]);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessages = [...newMessages, { role: 'model' as const, text: 'Sorry, I encountered an error.' }];
            onMessagesChange(errorMessages);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Always show chatbot button; onboarding flow doesn't require API key
    if (!API_KEY) {
        console.warn('UrbanBuddy: API_KEY not configured. Chat will use onboarding flow only.');
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-teal-700 text-white rounded-full p-4 shadow-lg hover:bg-teal-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 z-50"
                aria-label="Open AI Chat"
            >
                {isOpen ? <XIcon className="w-8 h-8"/> : <ChatbotIcon className="w-8 h-8" />}
            </button>

                        {isOpen && (
                <div className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 z-50 animate-fade-in-up">
                    <header className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center">
                            <ChatbotIcon className="w-6 h-6 text-teal-500 mr-2" />
                            <h3 className="font-bold text-lg text-slate-900">UrbanBuddy</h3>
                        </div>
                        {/* Back button - show when not on intro screen */}
                        {scriptSteps.length > 0 && scriptSteps[0]?.id !== 'intro' && (
                            <button
                                onClick={() => {
                                    // Navigate back based on current step
                                    const currentStep = scriptSteps[0]?.id;
                                    if (currentStep === 'siteAnalysisChecklist' || currentStep === 'fallback') {
                                        // Go back to goal selection
                                        if (sessionState.persona) {
                                            setScriptSteps([getGoalSelectionStep(sessionState.persona as any)]);
                                        } else {
                                            setScriptSteps([getIntroStep()]);
                                        }
                                    } else if (currentStep === 'goalSelection') {
                                        // Go back to intro
                                        setScriptSteps([getIntroStep()]);
                                    } else if (currentStep?.startsWith('navigated') || currentStep === 'helpBoundary' || currentStep === 'projectSaved') {
                                        // Go back to checklist
                                        handleScriptAction('backToChecklist');
                                    } else {
                                        // Default: go to intro
                                        setScriptSteps([getIntroStep()]);
                                    }
                                }}
                                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Go back"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                    </header>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                {/* Scripted Onboarding Steps */}
                                                {scriptSteps.map(step => (
                                                    <div key={step.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                                        <p className="text-sm text-slate-800 mb-2 whitespace-pre-line">{step.message}</p>
                                                        
                                                        {/* Interactive Checklist */}
                                                        {step.checklist && checklistItems.length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {checklistItems.map((item, index) => (
                                                                    <button
                                                                        key={item.id}
                                                                        onClick={() => toggleChecklistItem(item.id, item.action)}
                                                                        className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                                                                            item.completed 
                                                                                ? 'bg-teal-50 border-teal-500' 
                                                                                : 'bg-white border-slate-200 hover:border-teal-300'
                                                                        }`}
                                                                    >
                                                                        {/* Checkbox */}
                                                                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                                            item.completed 
                                                                                ? 'bg-teal-500 border-teal-500' 
                                                                                : 'border-slate-300'
                                                                        }`}>
                                                                            {item.completed && (
                                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Label */}
                                                                        <div className="flex-1 text-left">
                                                                            <span className={`text-sm font-medium ${
                                                                                item.completed 
                                                                                    ? 'text-teal-900 line-through' 
                                                                                    : 'text-slate-700'
                                                                            }`}>
                                                                                {index + 1}. {item.label}
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        {/* Arrow indicator */}
                                                                        {!item.completed && (
                                                                            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Regular buttons */}
                                                        {step.buttons && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {step.buttons.map(b => (
                                                                    <button
                                                                        key={b.action}
                                                                        onClick={() => handleScriptAction(b.action)}
                                                                        className="px-3 py-1.5 text-xs rounded-full bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-sm"
                                                                    >
                                                                        {b.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                        {messages.map((msg, index) => (
                             <div key={index} className={`w-full flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-teal-700 text-white rounded-br-lg' : 'bg-slate-100 text-slate-900 rounded-bl-lg'}`}>
                                   {msg.text}
                                </div>
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-2 max-w-[80%]">
                                        <p className="text-xs font-semibold text-gray-500 mb-1">Sources:</p>
                                        <div className="flex flex-col gap-2">
                                            {msg.sources.map((source, i) => source.maps && (
                                                <a 
                                                    key={i} 
                                                    href={source.maps.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 block truncate"
                                                    title={source.maps.title}
                                                >
                                                    📍 {source.maps.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                 <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-slate-100 text-slate-900 rounded-bl-lg">
                                    <Spinner className="w-5 h-5" />
                                 </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t border-slate-200">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Ask about the site..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                disabled={isLoading}
                            />
                            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-teal-700 text-white rounded-full hover:bg-teal-600 disabled:bg-slate-300">
                                {isLoading ? <Spinner className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};