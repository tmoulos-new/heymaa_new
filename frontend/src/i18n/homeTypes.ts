export interface HomeHowItem {
  icon: string;
  title: string;
  body: string;
}

export interface HomeFeatureItem {
  icon: string;
  bg: string;
  title: string;
  body: string;
}

export interface HomePlan {
  icon: string;
  name: string;
  price: string;
  period: string;
  badge: string;
  badgeColor: string;
  variant: string;
  save: string;
  features: string[];
  button: string;
  buttonClass: string;
}

export interface HomeSafetyItem {
  icon: string;
  bg: string;
  title: string;
  body: string;
}

export interface HomeFaqItem {
  question: string;
  answer: string;
}
