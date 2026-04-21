'use client';

import { useState, useMemo } from 'react';
import { MOCK_GRANTS, USA_STATES, CANADA_PROVINCES, Country, Region, Benefit } from '@/lib/grants-data';
import { GrantCard } from '@/components/GrantCard';
import { Leaf, Search, Filter } from 'lucide-react';

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<'All' | Country>('All');
  const [selectedRegion, setSelectedRegion] = useState<Region>('All Regions');
  const [selectedBenefit, setSelectedBenefit] = useState<'All' | Benefit>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const benefitsList: Benefit[] = [
    'Nutrient & Fertilizer Management',
    'Soil Health & Carbon',
    'Climate & Drought Resilience',
    'Water Quality & Conservation',
    'Crop Yield & Vigor',
    'On-Farm Trials & Research',
    'Specialty Crops'
  ];

  const { usaCount, canadaCount } = useMemo(() => {
    return {
      usaCount: MOCK_GRANTS.filter(g => g.country === 'USA').length,
      canadaCount: MOCK_GRANTS.filter(g => g.country === 'Canada').length,
    };
  }, []);

  const availableRegions = useMemo(() => {
    if (selectedCountry === 'USA') return ['All Regions', ...USA_STATES.filter(s => s !== 'All States')];
    if (selectedCountry === 'Canada') return ['All Regions', ...CANADA_PROVINCES.filter(s => s !== 'All Provinces')];
    return ['All Regions']; // When 'All' countries is selected
  }, [selectedCountry]);

  // Reset region when country changes
  const handleCountryChange = (c: 'All' | Country) => {
    setSelectedCountry(c);
    setSelectedRegion('All Regions');
  };

  const filteredGrants = useMemo(() => {
    return MOCK_GRANTS.filter(grant => {
      // Country Match
      if (selectedCountry !== 'All' && grant.country !== selectedCountry) return false;
      
      // Region Match 
      if (selectedRegion !== 'All Regions') {
        const hasRegion = grant.regions.includes(selectedRegion) || 
                          grant.regions.includes('All States') || 
                          grant.regions.includes('All Provinces');
        if (!hasRegion) return false;
      }

      // Benefit Match
      if (selectedBenefit !== 'All' && !grant.benefits.includes(selectedBenefit)) return false;

      // Search Match
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          grant.name.toLowerCase().includes(q) ||
          grant.organization.toLowerCase().includes(q) ||
          grant.description.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [selectedCountry, selectedRegion, selectedBenefit, searchQuery]);

  return (
    <div className="min-h-[100vh] flex flex-col">
      {/* HEADER / HERO */}
      <header className="border-b-2 border-[#1A1A1A] pt-16 pb-12 px-6 md:px-12 relative overflow-hidden bg-[#F9FAF8]">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-[#1A1A1A]">
          <Leaf size={400} />
        </div>
        <div className="max-w-7xl mx-auto relative z-10 w-full shrink-0">
          <div className="inline-flex items-center gap-2 mb-6 text-[#1A1A1A]">
            <span className="text-[10px] uppercase font-bold tracking-widest">North American Agriculture</span>
          </div>
          <h1 className="font-display text-[65px] md:text-[110px] uppercase text-[#1A1A1A] leading-[0.85] tracking-tight max-w-4xl mb-6">
            Bio-Stim<br className="hidden md:block"/> Grants
          </h1>
          <p className="text-sm font-medium text-[#1A1A1A] max-w-2xl leading-relaxed mb-8">
            Discover grants and financial incentives to adopt biologicals and biostimulants on your farm. Filter by USA or Canada, select your state or province, and find funding tailored to reducing fertilizer, improving soil health, and increasing abiotic stress resistance.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="border-2 border-[#1A1A1A] px-4 py-2 flex items-baseline gap-3 bg-[#1A1A1A] text-[#F9FAF8]">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Tracking USA</span>
              <span className="font-display text-2xl tracking-tighter leading-none">{usaCount}</span>
            </div>
            <div className="border-2 border-[#1A1A1A] px-4 py-2 flex items-baseline gap-3 bg-[#1A1A1A] text-[#F9FAF8]">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Tracking Canada</span>
              <span className="font-display text-2xl tracking-tighter leading-none">{canadaCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 flex-1 w-full">
        <div className="flex flex-col lg:flex-row gap-8 mt-4">
          
          {/* SIDEBAR FILTERS */}
          <aside className="w-full lg:w-72 shrink-0 space-y-8">
            <div className="bg-[#F9FAF8] p-6 border-2 border-[#1A1A1A]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-6 border-b-2 border-[#1A1A1A] pb-3">
                <Filter size={16} />
                Refine Search
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] mb-2 opacity-60">Keyword Search</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className="text-[#1A1A1A]" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g., Drought, NRCS"
                    className="block w-full pl-9 pr-3 py-2 text-xs font-bold border border-[#1A1A1A] bg-transparent focus:bg-[#1A1A1A] focus:text-[#F9FAF8] outline-none transition-colors placeholder:font-normal placeholder:opacity-50"
                  />
                </div>
              </div>

              {/* Country Filter */}
              <div className="mb-6">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] mb-2 opacity-60">Country</label>
                <div className="flex border border-[#1A1A1A]">
                  {['All', 'USA', 'Canada'].map(c => (
                    <button
                      key={c}
                      onClick={() => handleCountryChange(c as any)}
                      className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors border-r last:border-r-0 border-[#1A1A1A] ${selectedCountry === c ? 'bg-[#1A1A1A] text-[#F9FAF8]' : 'hover:bg-[#1A1A1A] hover:text-[#F9FAF8]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region Filter */}
              <div className="mb-6">
                 <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] mb-2 opacity-60">State / Province</label>
                 <select 
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    disabled={selectedCountry === 'All'}
                    className="block w-full px-3 py-2 text-xs font-bold uppercase tracking-wider border border-[#1A1A1A] bg-transparent disabled:opacity-30 focus:outline-none focus:ring-0"
                  >
                    {selectedCountry === 'All' ? (
                      <option>Select a country first</option>
                    ) : (
                      availableRegions.map(r => (
                        <option value={r} key={r}>{r}</option>
                      ))
                    )}
                 </select>
              </div>

              {/* Benefit Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A] mb-3 opacity-60">Targeted Benefit</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 border border-[#1A1A1A] flex items-center justify-center transition-colors group-hover:bg-[#1A1A1A] group-hover:border-[#1A1A1A] ${selectedBenefit === 'All' ? 'bg-[#1A1A1A]' : ''}`}>
                      {selectedBenefit === 'All' && <div className="w-2 h-2 bg-[#F9FAF8]" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">All Benefits</span>
                    <input type="radio" className="hidden" checked={selectedBenefit === 'All'} onChange={() => setSelectedBenefit('All')} />
                  </label>
                  
                  {benefitsList.map(b => (
                    <label key={b} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 border border-[#1A1A1A] flex items-center justify-center transition-colors group-hover:bg-[#1A1A1A] group-hover:border-[#1A1A1A] ${selectedBenefit === b ? 'bg-[#1A1A1A]' : ''}`}>
                        {selectedBenefit === b && <div className="w-2 h-2 bg-[#F9FAF8]" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">{b}</span>
                      <input type="radio" className="hidden" checked={selectedBenefit === b} onChange={() => setSelectedBenefit(b)} />
                    </label>
                  ))}
                </div>
              </div>

            </div>
          </aside>

          {/* RESULTS GRID */}
          <div className="flex-1">
            <div className="flex justify-between items-end mb-6 border-b-2 border-[#1A1A1A] pb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">
                Available Grants
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                {filteredGrants.length} Result{filteredGrants.length !== 1 && 's'}
              </span>
            </div>

            {filteredGrants.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredGrants.map(grant => (
                  <GrantCard grant={grant} key={grant.id} />
                ))}
              </div>
            ) : (
              <div className="bg-transparent border-2 text-center border-dashed border-[#1A1A1A] py-20 px-6">
                <Leaf size={48} className="mx-auto text-[#1A1A1A] opacity-30 mb-4" />
                <h3 className="font-display text-2xl uppercase text-[#1A1A1A] mb-2">No matching grants</h3>
                <p className="text-sm font-medium opacity-70 max-w-md mx-auto">
                  Try adjusting your filters or expanding your search query to find more opportunities.
                </p>
                <button 
                  onClick={() => {
                    setSelectedCountry('All');
                    setSelectedRegion('All Regions');
                    setSelectedBenefit('All');
                    setSearchQuery('');
                  }}
                  className="mt-6 px-6 py-2 border border-[#1A1A1A] text-[#1A1A1A] text-xs font-bold uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-[#F9FAF8] transition-colors inline-block"
                >
                  Clear Filters
                </button>
              </div>
            )}
            
            <footer className="mt-16 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center text-[10px] font-bold uppercase tracking-widest opacity-60 border-t border-[#1A1A1A]">
              <span className="mb-2 md:mb-0">© 2024 Biostimulant Resource Alliance</span>
              <div className="flex space-x-6">
                <span>Directory updated: Oct 20</span>
                <span>Data verified</span>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
