import React from 'react';
import { StarIcon } from 'lucide-react';
export const Testimonials: React.FC = () => {
  const testimonials = [{
    name: 'Sarah Johnson',
    role: 'Medical Student',
    image: 'https://randomuser.me/api/portraits/women/1.jpg',
    quote: 'LearnSmart AI has completely transformed how I study. The AI summaries and flashcards have made it so much easier to retain information.'
  }, {
    name: 'Michael Chen',
    role: 'Computer Science Major',
    image: 'https://randomuser.me/api/portraits/men/2.jpg',
    quote: "The AI tutor is like having a personal teacher available 24/7. It's helped me understand complex concepts in ways traditional studying never could."
  }, {
    name: 'Emily Rodriguez',
    role: 'High School Student',
    image: 'https://randomuser.me/api/portraits/women/3.jpg',
    quote: "I love how I can turn any YouTube video into a learning resource. The quizzes help me make sure I'm really understanding the material."
  }];
  return <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          What Our Users Say
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => <div key={index} className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => <StarIcon key={i} className="h-5 w-5 text-yellow-400 fill-current" />)}
              </div>
              <p className="text-gray-600 mb-6">"{testimonial.quote}"</p>
              <div className="flex items-center">
                <img src={testimonial.image} alt={testimonial.name} className="h-12 w-12 rounded-full mr-4" />
                <div>
                  <div className="font-medium">{testimonial.name}</div>
                  <div className="text-gray-600 text-sm">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </section>;
};