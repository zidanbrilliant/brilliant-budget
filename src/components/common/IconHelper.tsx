import React from 'react';
import {
  Landmark,
  Smartphone,
  PiggyBank,
  CreditCard,
  Banknote,
  Cake,
  ShoppingBag,
  Car,
  Receipt,
  Flower2,
  Heart,
  GraduationCap,
  Smile,
  Briefcase,
  BadgeDollarSign,
  TrendingUp,
  Gift,
  Film,
  CircleEllipsis,
  Tag,
  LucideProps,
} from 'lucide-react';

const iconMap: Record<string, React.FC<LucideProps>> = {
  Landmark,
  Smartphone,
  PiggyBank,
  CreditCard,
  Banknote,
  Cake,
  ShoppingBag,
  Car,
  Receipt,
  Flower2,
  Heart,
  GraduationCap,
  Smile,
  Briefcase,
  BadgeDollarSign,
  TrendingUp,
  Gift,
  Film,
  CircleEllipsis,
  Tag,
};

export const getIconComponent = (name: string, fallback = CircleEllipsis): React.FC<LucideProps> => {
  return iconMap[name] || fallback;
};

export const AppIcon: React.FC<{ name: string; className?: string; size?: number }> = ({
  name,
  className = 'w-5 h-5',
  size = 20,
}) => {
  const Icon = getIconComponent(name);
  return <Icon className={className} size={size} />;
};
