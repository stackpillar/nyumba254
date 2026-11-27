/**
 * Select Primitive
 * Cross-platform select dropdown
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: any;
}

const baseStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
    fontFamily: 'Inter_600SemiBold',
  },
  required: { color: '#C53030', marginLeft: 2 },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#1A1A18',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  placeholderText: { color: '#888780' },
  arrow: { paddingRight: 14, color: '#6B6A63' },
  helperText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  errorText: { color: '#C53030' },
  helperTextNormal: { color: '#6B6A63' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0DED8',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    maxHeight: 200,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#1A1A18' },
  optionDisabled: { color: '#888780' },
  divider: { height: 1, backgroundColor: '#E0DED8', marginHorizontal: 14 },
});

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      disabled,
      required,
      fullWidth = true,
      size = 'md',
      style,
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const borderColor = error ? '#C53030' : isOpen ? '#0F6E56' : '#E0DED8';
    const backgroundColor = disabled ? '#F7F6F2' : '#FFFFFF';

    const selectedOption = options.find(o => o.value === value);

    return (
      <View style={[{ width: '100%' }, style]}>
        {label && (
          <Text style={baseStyles.label}>
            {label}
            {required && <Text style={baseStyles.required}>*</Text>}
          </Text>
        )}
        <TouchableOpacity
          ref={ref}
          onPress={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          activeOpacity={0.9}
          style={[
            baseStyles.selectWrapper,
            { borderColor, backgroundColor },
          ]}
          accessibilityRole="combobox"
          accessibilityState={{ disabled, expanded: isOpen }}
          accessibilityLabel={label}
        >
          <Text style={[
            baseStyles.selectText,
            { color: selectedOption ? '#1A1A18' : '#888780' }
          ]}>
            {selectedOption?.label || placeholder}
          </Text>
          <Text style={baseStyles.arrow}>▼</Text>
        </TouchableOpacity>

        {isOpen && (
          <Modal
            visible={true}
            transparent
            animationType="none"
            onRequestClose={() => setIsOpen(false)}
          >
            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
              activeOpacity={1}
            >
              <View style={baseStyles.dropdown}>
                <ScrollView>
                  {options.map((option, index) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      disabled={option.disabled}
                      activeOpacity={0.7}
                      style={[
                        baseStyles.option,
                        index > 0 && { borderTopWidth: 1, borderTopColor: '#E0DED8' },
                      ]}
                    >
                      <Text style={[
                        baseStyles.optionText,
                        option.disabled && baseStyles.optionDisabled,
                        { color: option.value === value ? '#0F6E56' : undefined, fontWeight: option.value === value ? '600' : '400' }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {(error || helperText) && (
          <Text style={[baseStyles.helperText, error ? baseStyles.errorText : baseStyles.helperTextNormal]}>
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Select.displayName = 'Select';