import React from 'react';
import { Header } from '../components/Header';
import { FeatureCard } from '../components/FeatureCard';
import { FileTextIcon, BookOpenIcon, FlaskConicalIcon, HeadphonesIcon, MessageSquareIcon } from 'lucide-react';
interface HomePageProps {
  onNavigate: (page: string) => void;
}
export const HomePage: React.FC<HomePageProps> = ({
  onNavigate
}) => {
  const features = [{
    id: 'summary',
    title: 'AI Summaries',
    description: 'Get concise summaries of your learning materials',
    icon: FileTextIcon,
    color: 'bg-blue-100'
  }, {
    id: 'flashcards',
    title: 'Smart Flashcards',
    description: 'Auto-generated cards to boost retention',
    icon: BookOpenIcon,
    color: 'bg-green-100'
  }, {
    id: 'quiz',
    title: 'Practice Quizzes',
    description: 'Test your knowledge with AI-created quizzes',
    icon: FlaskConicalIcon,
    color: 'bg-purple-100'
  }, {
    id: 'audio',
    title: 'Audio Learning',
    description: 'Listen to your content on the go',
    icon: HeadphonesIcon,
    color: 'bg-orange-100'
  }, {
    id: 'tutor',
    title: 'AI Tutor',
    description: 'Get personalized help when you need it',
    icon: MessageSquareIcon,
    color: 'bg-pink-100'
  }];
  return <div className="flex flex-col w-full pb-20">
      <Header title="LearnSmart AI" />
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-xl p-5 text-white mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
          <p className="mb-4">Continue learning where you left off.</p>
          <button onClick={() => onNavigate('import')} className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium">
            Import New Content
          </button>
        </div>
        <h2 className="text-lg font-semibold mb-3">Learning Tools</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {features.map(feature => <FeatureCard key={feature.id} title={feature.title} description={feature.description} icon={feature.icon} color={feature.color} onClick={() => onNavigate(feature.id)} />)}
        </div>
        <h2 className="text-lg font-semibold mb-3">Recent Content</h2>
        <div className="space-y-3">
          <ContentPreview title="Quantum Physics Basics" source="YouTube" progress={75} onClick={() => {}} />
          <ContentPreview title="Introduction to Psychology" source="PDF" progress={30} onClick={() => {}} />
        </div>
      </div>
    </div>;
};
interface ContentPreviewProps {
  title: string;
  source: string;
  progress: number;
  onClick: () => void;
}
const ContentPreview: React.FC<ContentPreviewProps> = ({
  title,
  source,
  progress,
  onClick
}) => {
  return <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
          {source}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
        <div className="bg-blue-600 h-2 rounded-full" style={{
        width: `${progress}%`
      }}></div>
      </div>
      <span className="text-xs text-gray-500">{progress}% complete</span>
    </div>;
};