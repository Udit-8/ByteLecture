import React from 'react';
import { Header } from '../components/Header';
import { BookmarkIcon, CopyIcon, ShareIcon } from 'lucide-react';
export const SummaryPage: React.FC = () => {
  return <div className="flex flex-col w-full pb-20">
      <Header title="AI Summary" />
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <h2 className="text-lg font-semibold">
            Introduction to Quantum Physics
          </h2>
          <div className="flex items-center text-sm text-gray-500 mt-1 mb-3">
            <span>YouTube • 15 min video</span>
            <span className="mx-2">•</span>
            <span>Summarized in 3 min</span>
          </div>
          <div className="flex space-x-3 mb-4">
            <button className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              <BookmarkIcon size={14} className="mr-1" />
              Save
            </button>
            <button className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              <CopyIcon size={14} className="mr-1" />
              Copy
            </button>
            <button className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              <ShareIcon size={14} className="mr-1" />
              Share
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium mb-3">Summary</h3>
          <div className="space-y-3 text-gray-700">
            <p>
              Quantum physics is a fundamental theory in physics that describes
              the behavior of matter and energy at the atomic and subatomic
              scales. It departs from classical physics in several key ways:
            </p>
            <p>
              <strong>1. Wave-Particle Duality:</strong> Quantum objects can
              behave both as particles and waves. This was demonstrated in the
              famous double-slit experiment.
            </p>
            <p>
              <strong>2. Uncertainty Principle:</strong> Formulated by
              Heisenberg, this states that we cannot simultaneously know both
              the position and momentum of a particle with perfect precision.
            </p>
            <p>
              <strong>3. Quantum Superposition:</strong> Particles can exist in
              multiple states simultaneously until measured or observed.
            </p>
            <p>
              <strong>4. Quantum Entanglement:</strong> Particles can become
              "entangled" so that the quantum state of each particle cannot be
              described independently.
            </p>
            <p>
              These principles form the foundation of quantum mechanics and have
              led to technologies like lasers, transistors, and potentially
              quantum computers in the future.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h3 className="font-medium mb-3">Key Takeaways</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-600 rounded-full h-5 w-5 flex items-center justify-center text-xs mr-2 mt-0.5">
                  1
                </span>
                <span>
                  Quantum physics deals with atomic and subatomic scales
                </span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-600 rounded-full h-5 w-5 flex items-center justify-center text-xs mr-2 mt-0.5">
                  2
                </span>
                <span>Particles can behave as both waves and particles</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-600 rounded-full h-5 w-5 flex items-center justify-center text-xs mr-2 mt-0.5">
                  3
                </span>
                <span>
                  Heisenberg's uncertainty principle limits what we can know
                </span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-600 rounded-full h-5 w-5 flex items-center justify-center text-xs mr-2 mt-0.5">
                  4
                </span>
                <span>
                  Quantum entanglement connects particles across distances
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>;
};