import React from 'react';
import { BoxIcon } from 'lucide-react';
interface FeatureCardProps {
  title: string;
  description: string;
  icon: BoxIcon;
  color: string;
  onClick: () => void;
}
export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon: Icon,
  color,
  onClick
}) => {
  return <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col" onClick={onClick}>
      <div className={`${color} p-2 rounded-lg self-start mb-3`}>
        <Icon size={20} className="text-gray-700" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>;
};