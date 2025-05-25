import React, { useState } from 'react';
import { Header } from '../components/Header';
import { CheckIcon, XIcon } from 'lucide-react';
export const QuizPage: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const questions = [{
    question: 'Which principle states that we cannot simultaneously know both the position and momentum of a particle with perfect precision?',
    options: ['Wave-particle duality', "Heisenberg's Uncertainty Principle", 'Quantum superposition', 'Quantum entanglement'],
    correctAnswer: 1
  }, {
    question: 'What is the phenomenon where particles can exist in multiple states simultaneously until measured?',
    options: ['Wave-particle duality', "Heisenberg's Uncertainty Principle", 'Quantum superposition', 'Quantum entanglement'],
    correctAnswer: 2
  }, {
    question: 'The famous double-slit experiment demonstrates which quantum concept?',
    options: ['Wave-particle duality', "Heisenberg's Uncertainty Principle", 'Quantum superposition', 'Quantum entanglement'],
    correctAnswer: 0
  }];
  const handleAnswerSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === questions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }
  };
  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };
  return <div className="flex flex-col w-full pb-20">
      <Header title="Quiz" />
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h2 className="text-lg font-semibold">
            Introduction to Quantum Physics
          </h2>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-500">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <span className="text-blue-600 font-medium">
              Score: {score}/{questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{
            width: `${(currentQuestion + 1) / questions.length * 100}%`
          }}></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h3 className="text-lg font-medium mb-4">
            {questions[currentQuestion].question}
          </h3>
          <div className="space-y-3">
            {questions[currentQuestion].options.map((option, index) => <button key={index} className={`w-full p-4 rounded-lg border text-left ${selectedAnswer === index ? index === questions[currentQuestion].correctAnswer ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500' : showResult && index === questions[currentQuestion].correctAnswer ? 'bg-green-50 border-green-500' : 'bg-white border-gray-200'}`} onClick={() => handleAnswerSelect(index)} disabled={showResult}>
                <div className="flex justify-between items-center">
                  <span>{option}</span>
                  {showResult && index === questions[currentQuestion].correctAnswer && <CheckIcon size={20} className="text-green-500" />}
                  {showResult && selectedAnswer === index && index !== questions[currentQuestion].correctAnswer && <XIcon size={20} className="text-red-500" />}
                </div>
              </button>)}
          </div>
        </div>
        {showResult && <div className="mb-6">
            <div className={`p-4 rounded-lg ${selectedAnswer === questions[currentQuestion].correctAnswer ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <h4 className={`font-medium mb-2 ${selectedAnswer === questions[currentQuestion].correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
                {selectedAnswer === questions[currentQuestion].correctAnswer ? 'Correct!' : 'Incorrect'}
              </h4>
              <p className="text-sm text-gray-700">
                {selectedAnswer === questions[currentQuestion].correctAnswer ? 'Great job! You selected the right answer.' : `The correct answer is: ${questions[currentQuestion].options[questions[currentQuestion].correctAnswer]}`}
              </p>
            </div>
          </div>}
        {showResult && currentQuestion < questions.length - 1 && <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium" onClick={handleNextQuestion}>
            Next Question
          </button>}
        {showResult && currentQuestion === questions.length - 1 && <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Quiz Complete!</h3>
            <p className="text-gray-600 mb-4">
              Your final score is {score} out of {questions.length}
            </p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium">
              See Detailed Results
            </button>
          </div>}
      </div>
    </div>;
};