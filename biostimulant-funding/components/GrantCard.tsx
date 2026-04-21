import { Grant } from '@/lib/grants-data';
import { ExternalLink, MapPin, Building2, Calendar, DollarSign, Sprout } from 'lucide-react';

interface GrantCardProps {
  grant: Grant;
}

export function GrantCard({ grant }: GrantCardProps) {
  return (
    <div className="bg-[#F9FAF8] border-2 border-[#1A1A1A] p-6 flex flex-col h-full relative transition-colors duration-200 hover:bg-[#1A1A1A] hover:text-[#F9FAF8] group">
      
      <div className="flex-grow">
        <div className="flex justify-between items-start mb-4">
          <span className="inline-flex items-center gap-1 border border-[#1A1A1A] bg-transparent text-[#1A1A1A] text-[10px] font-bold px-2 py-1 uppercase tracking-widest group-hover:border-[#F9FAF8] group-hover:text-[#F9FAF8] transition-colors">
            {grant.country} {grant.isFederal ? '(Federal)' : ''}
          </span>
          <a
            href={grant.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1A1A1A] group-hover:text-[#F9FAF8] transition-colors"
            aria-label={`External link to ${grant.name}`}
          >
            <ExternalLink size={18} />
          </a>
        </div>
        
        <h3 className="font-display text-2xl uppercase leading-[0.9] text-[#1A1A1A] mb-3 group-hover:text-[#F9FAF8] transition-colors">
          {grant.name}
        </h3>
        
        <div className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-4 text-[#2D5A27] group-hover:text-white transition-colors">
          <Building2 size={16} />
          {grant.organization}
        </div>

        <p className="text-sm font-medium mb-6 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
          {grant.description}
        </p>
      </div>

      <div className="space-y-3 mt-auto">
        <div className="flex items-start gap-2 text-xs font-bold uppercase tracking-wide">
          <DollarSign size={16} className="mt-0.5 shrink-0 opacity-50 text-[#1A1A1A] group-hover:text-[#F9FAF8] transition-colors" />
          <span>{grant.amount}</span>
        </div>
        <div className="flex items-start gap-2 text-xs font-bold uppercase tracking-wide">
          <Calendar size={16} className="mt-0.5 shrink-0 opacity-50 text-[#1A1A1A] group-hover:text-[#F9FAF8] transition-colors" />
          <span>{grant.deadline}</span>
        </div>
        <div className="flex items-start gap-2 text-xs font-bold uppercase tracking-wide">
          <MapPin size={16} className="mt-0.5 shrink-0 opacity-50 text-[#1A1A1A] group-hover:text-[#F9FAF8] transition-colors" />
          <span>
            {grant.regions.join(', ')}
          </span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t-2 border-[#1A1A1A] group-hover:border-[#F9FAF8] transition-colors">
        <div className="flex items-center gap-1.5 mb-3 opacity-60">
          <Sprout size={14} className="text-[#1A1A1A] group-hover:text-[#F9FAF8] transition-colors" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Core Benefits</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {grant.benefits.map(benefit => (
            <span key={benefit} className="inline-block border border-[#1A1A1A] text-[10px] font-bold uppercase tracking-widest px-2 py-1 group-hover:border-[#F9FAF8] transition-colors">
              {benefit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
