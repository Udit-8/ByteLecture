import React, { useState } from 'react';
import { Header } from '../components/Header';
import { SendIcon, MicIcon, ImageIcon, BookOpenIcon, LightbulbIcon } from 'lucide-react';
export const TutorPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const messages = [{
    sender: 'ai',
    content: "Hello! I'm your AI tutor for Quantum Physics. How can I help you today?",
    timestamp: '10:30 AM'
  }, {
    sender: 'user',
    content: "I'm confused about the double-slit experiment. Can you explain it?",
    timestamp: '10:31 AM'
  }, {
    sender: 'ai',
    content: "The double-slit experiment is a fundamental demonstration of quantum mechanics. Here's a simple explanation:\n\nWhen light passes through two parallel slits, it creates an interference pattern on a screen behind the slits, showing light behaves as a wave.\n\nHowever, when individual photons (light particles) are sent one at a time, they still create the same interference pattern over time, even though each photon can only go through one slit.\n\nEven more strangely, if you try to observe which slit each photon goes through, the interference pattern disappears and you get two bands instead.\n\nThis demonstrates wave-particle duality - photons behave as both particles and waves - and suggests that the act of measurement affects quantum systems.",
    timestamp: '10:32 AM'
  }];
  const handleSend = () => {
    if (message.trim()) {
      // In a real app, this would send the message to an AI service
      setMessage('');
    }
  };
  return <div className="flex flex-col w-full h-screen pb-20">
      <Header title="AI Tutor" />
      <div className="bg-white p-4 shadow-sm mb-2 flex items-center justify-between">
        <div>
          <h2 className="font-medium">Quantum Physics Tutor</h2>
          <span className="text-xs text-gray-500">
            Specialized in quantum mechanics
          </span>
        </div>
        <div className="flex space-x-2">
          <button className="bg-blue-100 p-2 rounded-full">
            <BookOpenIcon size={20} className="text-blue-600" />
          </button>
          <button className="bg-blue-100 p-2 rounded-full">
            <LightbulbIcon size={20} className="text-blue-600" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 bg-gray-50">
        {messages.map((msg, index) => <div key={index} className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white shadow-sm rounded-bl-none'}`}>
              <p className="whitespace-pre-line">{msg.content}</p>
              <span className={`text-xs block text-right mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>)}
      </div>
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
          <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask your question..." className="flex-1 bg-transparent outline-none" />
          <div className="flex space-x-2">
            <button className="p-2 text-gray-500">
              <MicIcon size={20} />
            </button>
            <button className="p-2 text-gray-500">
              <ImageIcon size={20} />
            </button>
            <button className={`p-2 rounded-full ${message.trim() ? 'bg-blue-600 text-white' : 'text-gray-400'}`} onClick={handleSend} disabled={!message.trim()}>
              <SendIcon size={20} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex space-x-2">
          <button className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
            Explain wave function
          </button>
          <button className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
            What is superposition?
          </button>
          <button className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
            Quiz me
          </button>
        </div>
      </div>
    </div>;
};