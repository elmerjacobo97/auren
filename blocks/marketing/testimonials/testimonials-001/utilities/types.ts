export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  initials?: string;
}

export interface TestimonialsProps {
  heading?: string;
  description?: string;
  items?: readonly TestimonialItem[];
  id?: string;
  className?: string;
}
