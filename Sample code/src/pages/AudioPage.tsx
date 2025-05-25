import React from 'react';
import { Header } from '../components/Header';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, Volume2Icon, ListIcon, RepeatIcon } from 'lucide-react';
export const AudioPage: React.FC = () => {
  return <div className="flex flex-col w-full pb-20">
      <Header title="Audio Learning" />
      <div className="px-4 pt-4 flex flex-col h-full">
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h2 className="text-lg font-semibold">
            Introduction to Quantum Physics
          </h2>
          <span className="text-sm text-gray-500">Audio summary • 6:32</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center mb-10">
          <div className="w-48 h-48 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg mb-8 flex items-center justify-center">
            <div className="bg-white bg-opacity-20 rounded-full p-6">
              <Volume2Icon size={48} className="text-white" />
            </div>
          </div>
          <h3 className="text-xl font-medium mb-1">Quantum Physics Basics</h3>
          <p className="text-gray-500 text-sm mb-6">
            Audio summary by LearnSmart AI
          </p>
          <div className="w-full mb-4">
            <div className="relative w-full">
              <div className="absolute left-0 right-0 -top-6 flex justify-between text-xs text-gray-500">
                <span>2:45</span>
                <span>6:32</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div className="bg-blue-600 h-1 rounded-full w-2/5"></div>
                <div className="absolute -top-1 left-[40%] w-3 h-3 bg-blue-600 rounded-full"></div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-6">
            <button className="text-gray-600">
              <SkipBackIcon size={24} />
            </button>
            <button className="bg-blue-600 rounded-full p-4 text-white">
              <PauseIcon size={24} />
            </button>
            <button className="text-gray-600">
              <SkipForwardIcon size={24} />
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium mb-1">Playback Options</h3>
          </div>
          <div className="p-4 flex justify-between items-center border-b border-gray-100">
            <span className="text-gray-700">Playback Speed</span>
            <select className="bg-gray-100 rounded-lg px-2 py-1 text-sm">
              <option>0.75x</option>
              <option>1x</option>
              <option selected>1.25x</option>
              <option>1.5x</option>
              <option>2x</option>
            </select>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="text-gray-700">Auto-skip silence</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="skip-silence" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
        </div>
        <div className="flex space-x-4 mb-6">
          <button className="flex items-center justify-center flex-1 py-3 bg-gray-100 rounded-lg text-gray-700">
            <ListIcon size={20} className="mr-2" />
            View Transcript
          </button>
          <button className="flex items-center justify-center flex-1 py-3 bg-gray-100 rounded-lg text-gray-700">
            <RepeatIcon size={20} className="mr-2" />
            Loop Section
          </button>
        </div>
      </div>
    </div>;
};