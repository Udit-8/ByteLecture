import React from 'react';
import { FileTextIcon, BookOpenIcon, FlaskConicalIcon, HeadphonesIcon, MessageSquareIcon, SparklesIcon } from 'lucide-react';
export const Features: React.FC = () => {
  const features = [{
    icon: FileTextIcon,
    title: 'AI-Powered Summaries',
    description: 'Get instant, comprehensive summaries of any learning material. Our AI extracts key concepts and important points.'
  }, {
    icon: BookOpenIcon,
    title: 'Smart Flashcards',
    description: 'Automatically generated flashcards that adapt to your learning style and help you remember key information.'
  }, {
    icon: FlaskConicalIcon,
    title: 'Interactive Quizzes',
    description: 'Test your knowledge with AI-generated quizzes that focus on important concepts and track your progress.'
  }, {
    icon: HeadphonesIcon,
    title: 'Audio Learning',
    description: 'Convert any text content into high-quality audio for learning on the go. Perfect for auditory learners.'
  }, {
    icon: MessageSquareIcon,
    title: 'AI Tutoring',
    description: 'Get instant help from our AI tutor. Ask questions, get explanations, and deepen your understanding.'
  }, {
    icon: SparklesIcon,
    title: 'Personalized Learning',
    description: 'Our AI adapts to your learning style and pace, creating a customized learning experience just for you.'
  }];
  return <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Features that Transform Learning
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
          const Icon = feature.icon;
          return <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>;
        })}
        </div>
      </div>
    </section>;
};