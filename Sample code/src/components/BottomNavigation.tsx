import React from 'react';
import { HomeIcon, BookOpenIcon, FileTextIcon, FlaskConicalIcon, HeadphonesIcon, MessageSquareIcon, UploadIcon } from 'lucide-react';
interface BottomNavigationProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}
export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentPage,
  setCurrentPage
}) => {
  const navItems = [{
    id: 'home',
    icon: HomeIcon,
    label: 'Home'
  }, {
    id: 'import',
    icon: UploadIcon,
    label: 'Import'
  }, {
    id: 'summary',
    icon: FileTextIcon,
    label: 'Summary'
  }, {
    id: 'flashcards',
    icon: BookOpenIcon,
    label: 'Cards'
  }, {
    id: 'quiz',
    icon: FlaskConicalIcon,
    label: 'Quiz'
  }, {
    id: 'audio',
    icon: HeadphonesIcon,
    label: 'Audio'
  }, {
    id: 'tutor',
    icon: MessageSquareIcon,
    label: 'Tutor'
  }];
  return <div className="fixed bottom-0 left-0 right-0 flex justify-around items-center bg-white shadow-lg border-t border-gray-200 pt-2 pb-6">
      {navItems.map(item => {
      const Icon = item.icon;
      const isActive = currentPage === item.id;
      return <button key={item.id} className="flex flex-col items-center justify-center" onClick={() => setCurrentPage(item.id)}>
            <Icon size={24} className={`mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
            <span className={`text-xs ${isActive ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              {item.label}
            </span>
          </button>;
    })}
    </div>;
};