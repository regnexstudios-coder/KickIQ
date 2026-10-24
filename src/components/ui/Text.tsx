import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'mono';

const variantClass: Record<Variant, string> = {
  display: 'font-display text-ink text-6xl leading-none tracking-tight',
  title: 'font-display text-ink text-4xl leading-tight',
  heading: 'font-displayBold text-ink text-2xl leading-tight',
  body: 'font-sans text-ink text-base leading-6',
  bodyStrong: 'font-sansSemi text-ink text-base leading-6',
  caption: 'font-sans text-muted text-sm leading-5',
  label: 'font-sansSemi text-muted text-xs uppercase tracking-widest',
  mono: 'font-sansMedium text-ink text-sm',
};

export interface TProps extends TextProps {
  variant?: Variant;
  className?: string;
}

export function T({ variant = 'body', className = '', ...rest }: TProps) {
  return <RNText {...rest} className={`${variantClass[variant]} ${className}`} />;
}
