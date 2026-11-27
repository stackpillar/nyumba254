/**
 * Layout Components
 * Cross-platform layout primitives
 */

import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: any;
}

const sizeStyles = {
  sm: { maxWidth: 640 },
  md: { maxWidth: 768 },
  lg: { maxWidth: 1024 },
  xl: { maxWidth: 1280 },
  full: { maxWidth: 'none' },
};

const paddingStyles = {
  none: { paddingHorizontal: 0 },
  sm: { paddingHorizontal: 16 },
  md: { paddingHorizontal: 24 },
  lg: { paddingHorizontal: 32 },
};

const baseStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginHorizontal: 'auto',
  },
  centered: {
    alignItems: 'center',
  },
});

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    { children, size = 'xl', padding = 'md', className, style, ...props },
    ref
  ) => {
    return (
      <View
        ref={ref}
        style={[
          baseStyles.container,
          sizeStyles[size],
          paddingStyles[padding],
          style,
        ]}
        className={cn(className)}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Container.displayName = 'Container';

export interface StackProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal';
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  className?: string;
  style?: any;
}

const gapStyles = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const alignStyles = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const justifyStyles = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

const flexDirectionStyles = {
  vertical: 'column',
  horizontal: 'row',
};

const wrapStyles = {
  true: 'wrap',
  false: 'nowrap',
};

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      direction = 'vertical',
      gap = 'md',
      align = 'stretch',
      justify = 'start',
      wrap = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <View
        ref={ref}
        style={[
          {
            flexDirection: flexDirectionStyles[direction],
            gap: gapStyles[gap],
            alignItems: alignStyles[align],
            justifyContent: justifyStyles[justify],
            flexWrap: wrapStyles[wrap.toString()],
          },
          style,
        ]}
        className={cn(className)}
        {...props}
      >
        {children}
      </View>
    );
  }
);

Stack.displayName = 'Stack';

export interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  responsive?: boolean;
  className?: string;
  style?: any;
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    { children, columns = 3, gap = 'md', responsive = true, className, style, ...props },
    ref
  ) => {
    // For React Native, we use a flat list approach
    // Web version would use CSS Grid
    const columnWidth = `calc(100% / ${columns})`;

    return (
      <View
        ref={ref}
        style={[
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: gapStyles[gap],
          },
          style,
        ]}
        className={cn(className)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              style: [
                { flex: `0 0 ${columnWidth}`, maxWidth: columnWidth },
                child.props.style,
              ],
            });
          }
          return child;
        })}
      </View>
    );
  }
);

Grid.displayName = 'Grid';

export interface SectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  style?: any;
}

export const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  (
    { children, title, subtitle, action, className, style, ...props },
    ref
  ) => {
    return (
      <View ref={ref} style={[{ paddingVertical: 24 }, style]} className={cn(className)} {...props}>
        {(title || subtitle || action) && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <View>
              {title && (
                <Text style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: '#1A1A18', fontWeight: '600' }}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text style={{ fontSize: 12.5, color: '#6B6A63', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
                  {subtitle}
                </Text>
              )}
            </View>
            {action}
          </View>
        )}
        {children}
      </View>
    );
  }
);

Section.displayName = 'Section';

export interface PageShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  style?: any;
}

export const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  (
    { children, header, footer, sidebar, className, style, ...props },
    ref
  ) => {
    return (
      <SafeAreaView ref={ref} style={[{ flex: 1, backgroundColor: '#F7F6F2' }, style]} className={cn(className)} {...props}>
        {header && <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{header}</View>}
        <View style={{ flex: 1 }}>
          {sidebar && (
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 280, borderRightWidth: 1, borderRightColor: '#E0DED8', padding: 16 }}>
                {sidebar}
              </View>
              <View style={{ flex: 1, padding: 16 }}>{children}</View>
            </View>
          )}
          {!sidebar && <View style={{ padding: 16 }}>{children}</View>}
        </View>
        {footer && <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#E0DED8' }}>{footer}</View>}
      </SafeAreaView>
    );
  }
);

PageShell.displayName = 'PageShell';

export interface ScrollViewProps {
  children: React.ReactNode;
  horizontal?: boolean;
  showsScrollIndicator?: boolean;
  contentContainerStyle?: any;
  className?: string;
  style?: any;
}

export const ScrollView = React.forwardRef<HTMLDivElement, ScrollViewProps>(
  (
    { children, horizontal = false, showsScrollIndicator = false, contentContainerStyle, className, style, ...props },
    ref
  ) => {
    return (
      <ScrollView
        ref={ref}
        horizontal={horizontal}
        showsHorizontalScrollIndicator={showsScrollIndicator}
        showsVerticalScrollIndicator={showsScrollIndicator}
        contentContainerStyle={contentContainerStyle}
        style={[{ flex: 1 }, style]}
        className={cn(className)}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

ScrollView.displayName = 'ScrollView';