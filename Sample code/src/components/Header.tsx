import React from 'react';
import { BellIcon, UserIcon } from 'lucide-react';
interface HeaderProps {
  title: string;
}
export const Header: React.FC<HeaderProps> = ({
  title
}) => {
  return <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
      <h1 className="text-xl font-bold text-blue-600">{title}</h1>
      <div className="flex items-center space-x-4">
        <button className="text-gray-500">
          <BellIcon size={20} />
        </button>
        <button className="bg-gray-100 rounded-full p-1">
          <UserIcon size={20} className="text-gray-600" />
        </button>
      </div>
    </header>;
};