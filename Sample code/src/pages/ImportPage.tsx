import React, { useState } from 'react';
import { Header } from '../components/Header';
import { FileIcon, YoutubeIcon, UploadIcon } from 'lucide-react';
export const ImportPage: React.FC = () => {
  const [importType, setImportType] = useState<'pdf' | 'youtube' | null>(null);
  return <div className="flex flex-col w-full pb-20">
      <Header title="Import Content" />
      <div className="px-4 pt-6">
        <h2 className="text-xl font-semibold mb-6">Import learning material</h2>
        {!importType ? <div className="space-y-4">
            <button className="w-full bg-white p-4 rounded-xl border border-gray-200 flex items-center" onClick={() => setImportType('pdf')}>
              <div className="bg-blue-100 p-2 rounded-lg mr-4">
                <FileIcon size={24} className="text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Import PDF</h3>
                <p className="text-sm text-gray-500">Upload PDF documents</p>
              </div>
            </button>
            <button className="w-full bg-white p-4 rounded-xl border border-gray-200 flex items-center" onClick={() => setImportType('youtube')}>
              <div className="bg-red-100 p-2 rounded-lg mr-4">
                <YoutubeIcon size={24} className="text-red-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium">YouTube Link</h3>
                <p className="text-sm text-gray-500">
                  Import from YouTube video
                </p>
              </div>
            </button>
          </div> : importType === 'pdf' ? <PDFImport /> : <YouTubeImport />}
      </div>
    </div>;
};
const PDFImport: React.FC = () => {
  return <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-blue-100 p-3 rounded-full mb-4">
          <UploadIcon size={24} className="text-blue-600" />
        </div>
        <p className="text-gray-600 mb-2">Drag & drop your PDF here</p>
        <p className="text-gray-400 text-sm mb-4">or</p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">
          Browse files
        </button>
      </div>
      <div>
        <h3 className="font-medium mb-2">Options</h3>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm">Generate summary</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="summary" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm">Create flashcards</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="flashcards" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Generate quiz questions</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="quiz" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
const YouTubeImport: React.FC = () => {
  return <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="youtube-url" className="text-sm font-medium">
          YouTube URL
        </label>
        <input type="text" id="youtube-url" placeholder="https://www.youtube.com/watch?v=..." className="w-full p-3 border border-gray-300 rounded-lg" />
      </div>
      <div>
        <h3 className="font-medium mb-2">Options</h3>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm">Generate transcript</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="transcript" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm">Generate summary</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="summary" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Create flashcards</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input type="checkbox" id="flashcards" defaultChecked className="sr-only" />
              <div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div>
              <div className="absolute w-5 h-5 bg-blue-600 rounded-full shadow -left-1 -top-0"></div>
            </div>
          </div>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">
        Import Content
      </button>
    </div>;
};