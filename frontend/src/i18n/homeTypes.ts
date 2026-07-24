export interface HomeHowItem {
  icon: string;
  bg: string;
  color: string;
  title: string;
  lead: string;
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
  featured?: boolean;
  save: string;
  features: string[];
  button: string;
  buttonClass: string;
}

export interface HomeTestimonialItem {
  quote: string;
  initial: string;
  name: string;
  location: string;
}

export interface HomeSafetyItem {
  icon: string;
  text: string;
}

export interface HomeFaqItem {
  question: string;
  answer: string;
}
