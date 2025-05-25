import React, { useState } from 'react';
import { Header } from '../components/Header';
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react';
export const FlashcardsPage: React.FC = () => {
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = [{
    question: 'What is wave-particle duality?',
    answer: 'The concept that quantum objects can behave both as particles and waves, depending on how they are observed or measured.'
  }, {
    question: "What is Heisenberg's Uncertainty Principle?",
    answer: 'A principle stating that we cannot simultaneously know both the position and momentum of a particle with perfect precision.'
  }, {
    question: 'What is quantum superposition?',
    answer: 'The ability of quantum systems to exist in multiple states simultaneously until measured or observed.'
  }, {
    question: 'What is quantum entanglement?',
    answer: 'A phenomenon where particles become connected so that the quantum state of each particle cannot be described independently of the others.'
  }];
  const nextCard = () => {
    if (currentCard < cards.length - 1) {
      setCurrentCard(currentCard + 1);
      setFlipped(false);
    }
  };
  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setFlipped(false);
    }
  };
  return <div className="flex flex-col w-full pb-20">
      <Header title="Flashcards" />
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h2 className="text-lg font-semibold">
            Introduction to Quantum Physics
          </h2>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-500">
              Card {currentCard + 1} of {cards.length}
            </span>
            <button className="flex items-center text-blue-600">
              <RotateCcwIcon size={14} className="mr-1" />
              Reset Progress
            </button>
          </div>
        </div>
        <div className="relative w-full aspect-[4/3] mb-6" onClick={() => setFlipped(!flipped)}>
          <div className={`absolute w-full h-full rounded-xl shadow-md transition-all duration-500 ${flipped ? 'rotate-y-180 opacity-0' : 'rotate-y-0 opacity-100'}`}>
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 flex items-center justify-center">
              <h3 className="text-xl font-medium text-white text-center">
                {cards[currentCard].question}
              </h3>
            </div>
          </div>
          <div className={`absolute w-full h-full rounded-xl shadow-md transition-all duration-500 ${flipped ? 'rotate-y-0 opacity-100' : 'rotate-y-180 opacity-0'}`}>
            <div className="w-full h-full bg-white border-2 border-blue-500 rounded-xl p-6 flex items-center justify-center">
              <p className="text-gray-800 text-center">
                {cards[currentCard].answer}
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <button className={`flex items-center justify-center w-12 h-12 rounded-full ${currentCard > 0 ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`} onClick={prevCard} disabled={currentCard === 0}>
            <ChevronLeftIcon size={24} />
          </button>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Tap card to flip</p>
            <div className="flex space-x-1">
              {cards.map((_, index) => <div key={index} className={`w-2 h-2 rounded-full ${index === currentCard ? 'bg-blue-600' : 'bg-gray-300'}`} />)}
            </div>
          </div>
          <button className={`flex items-center justify-center w-12 h-12 rounded-full ${currentCard < cards.length - 1 ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`} onClick={nextCard} disabled={currentCard === cards.length - 1}>
            <ChevronRightIcon size={24} />
          </button>
        </div>
      </div>
    </div>;
};