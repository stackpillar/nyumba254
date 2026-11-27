/**
 * SearchBox Composite
 * Hero search box with filters
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { cn } from '@nyumba254/design-system';

export interface SearchBoxProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  filters: {
    county: string;
    area: string;
    budget: string;
    beds: string;
  };
  onFilterChange: (filter: string, value: string) => void;
  counties: Array<{ value: string; label: string }>;
  areas: Array<{ value: string; label: string }>;
  budgets: Array<{ value: string; label: string }>;
  beds: Array<{ value: string; label: string }>;
  showMoreFilters?: boolean;
  onToggleFilters?: () => void;
  placeholder?: string;
  className?: string;
  style?: any;
}

const baseStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  mainRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F6F2',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#1A1A18',
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: '#0F6E56',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterSelect: {
    flex: 1,
    minWidth: 120,
  },
  moreFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E1F5EE',
    borderWidth: 1,
    borderColor: '#9FE1CB',
    marginTop: 8,
  },
  moreFiltersText: {
    color: '#085041',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DED8',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
    zIndex: 50,
    maxHeight: 380,
  },
  dropdownGroup: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  dropdownGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B6A63',
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  dropdownItemImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  dropdownItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#E1F5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1A1A18',
    fontFamily: 'Inter_600SemiBold',
  },
  dropdownItemSub: {
    fontSize: 12,
    color: '#6B6A63',
    fontFamily: 'Inter_400Regular',
  },
  dropdownEmpty: {
    padding: 16,
    textAlign: 'center',
    color: '#6B6A63',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  recentSearches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  recentChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  recentChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  statRow: {
    flexDirection: 'row',
    gap: 32,
    flexWrap: 'wrap',
    marginTop: 18,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
});

export const SearchBox = React.forwardRef<HTMLDivElement, SearchBoxProps>(
  (
    {
      query,
      onQueryChange,
      onSearch,
      filters,
      onFilterChange,
      counties,
      areas,
      budgets,
      beds,
      showMoreFilters = false,
      onToggleFilters,
      placeholder = 'Try "2 bedroom Kilimani under 50k"',
      className,
      style,
    },
    ref
  ) => {
    const [showFilters, setShowFilters] = React.useState(false);

    const handleSubmit = (e: any) => {
      e.preventDefault();
      onSearch();
    };

    return (
      <form ref={ref} onSubmit={handleSubmit} style={[baseStyles.container, style]} className={cn(className)}>
        <View style={baseStyles.mainRow}>
          <View style={baseStyles.inputWrapper}>
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={placeholder}
              placeholderTextColor="#888780"
              style={baseStyles.input}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={baseStyles.searchButton} onPress={onSearch} activeOpacity={0.9}>
            <Text style={baseStyles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={baseStyles.moreFiltersButton}
          onPress={onToggleFilters || (() => setShowFilters(!showFilters))}
          activeOpacity={0.8}
        >
          <Text style={baseStyles.moreFiltersText}>
            {showFilters ? 'Fewer filters' : 'More filters'}
          </Text>
        </TouchableOpacity>

        {showFilters && (
          <View style={baseStyles.filterRow}>
            <Select
              options={counties}
              value={filters.county}
              onChange={(v) => onFilterChange('county', v)}
              placeholder="All counties"
              style={baseStyles.filterSelect}
            />
            <Select
              options={areas}
              value={filters.area}
              onChange={(v) => onFilterChange('area', v)}
              placeholder="All areas"
              style={baseStyles.filterSelect}
            />
            <Select
              options={budgets}
              value={filters.budget}
              onChange={(v) => onFilterChange('budget', v)}
              placeholder="Any budget"
              style={baseStyles.filterSelect}
            />
            <Select
              options={beds}
              value={filters.beds}
              onChange={(v) => onFilterChange('beds', v)}
              placeholder="Any beds"
              style={baseStyles.filterSelect}
            />
          </View>
        )}
      </form>
    );
  }
);

SearchBox.displayName = 'SearchBox';