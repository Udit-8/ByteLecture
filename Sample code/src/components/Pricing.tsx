import React from 'react';
import { CheckIcon } from 'lucide-react';
export const Pricing: React.FC = () => {
  const plans = [{
    name: 'Free',
    price: '0',
    description: 'Perfect for trying out the platform',
    features: ['5 AI summaries per month', 'Basic flashcard creation', 'Limited quiz generation', 'Community support']
  }, {
    name: 'Pro',
    price: '12',
    description: 'Most popular for students',
    features: ['Unlimited AI summaries', 'Advanced flashcard systems', 'Unlimited quiz generation', 'Audio learning feature', 'Priority support', 'Progress tracking']
  }, {
    name: 'Team',
    price: '49',
    description: 'Perfect for study groups',
    features: ['Everything in Pro', '5 team members', 'Team progress tracking', 'Collaborative learning', 'Admin dashboard', '24/7 priority support']
  }];
  return <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Simple, Transparent Pricing
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => <div key={index} className={`bg-white rounded-xl p-8 ${index === 1 ? 'border-2 border-blue-600 shadow-lg relative' : 'border border-gray-200'}`}>
              {index === 1 && <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                    Most Popular
                  </span>
                </div>}
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 mb-6">{plan.description}</p>
              <button className={`w-full py-2 rounded-lg mb-6 ${index === 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                Get Started
              </button>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => <li key={i} className="flex items-center text-gray-600">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                    {feature}
                  </li>)}
              </ul>
            </div>)}
        </div>
      </div>
    </section>;
};