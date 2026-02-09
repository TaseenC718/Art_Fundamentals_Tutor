
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Icons } from './Icon';

interface ChatInterfaceProps {
  initialMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialMessage }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: initialMessage || "Hello! I'm your Perspective Tutor. Ask me about vanishing points, horizon lines, or how to rotate a cube.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for API - exclude welcome message (Gemini requires first message to be 'user')
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      const responseText = await sendMessageToGemini(history, userMsg.content);

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "I'm having trouble connecting to the art studio (API Error). Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-paper relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-sm p-4 shadow-sketch border-2 border-pencil ${msg.role === 'user'
                ? 'bg-sketch-blue text-pencil rounded-br-none transform rotate-1'
                : 'bg-white text-pencil rounded-bl-none transform -rotate-1'
                }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed font-hand text-lg font-bold">{msg.content}</p>
              ) : (
                /* Removed redundant role check since msg.role is guaranteed to be 'model' in this branch */
                <MarkdownRenderer content={msg.content} />
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="bg-white rounded-sm rounded-bl-none p-4 border-2 border-pencil flex items-center gap-2 shadow-sketch transform -rotate-1">
              <span className="w-2 h-2 bg-pencil rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-pencil rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-pencil rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-paper border-t-2 border-pencil border-dashed">
        <div className="relative max-w-4xl mx-auto flex items-end gap-2 bg-white border-2 border-pencil rounded-sm p-2 shadow-sketch">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about vanishing points..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-pencil placeholder:text-pencil/50 font-hand text-lg"
            rows={1}
            style={{ height: 'auto', minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-2.5 rounded-sm mb-0.5 transition-all border-2 ${!input.trim() || isLoading
              ? 'bg-paper text-pencil/30 border-pencil/30 cursor-not-allowed'
              : 'bg-sketch-orange text-pencil border-pencil hover:bg-sketch-yellow shadow-sm hover:-translate-y-0.5'
              }`}
          >
            {isLoading ? <Icons.Loader /> : <Icons.Send />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
