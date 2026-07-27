/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				border: 'hsl(var(--sidebar-border))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'row-leave': {
  				'0%': { opacity: '1', transform: 'translateX(0)' },
  				'100%': { opacity: '0', transform: 'translateX(1.5rem)' }
  			},
  			'row-enter': {
  				'0%': { opacity: '0', transform: 'translateY(-0.25rem)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			'row-flash': {
  				'0%, 100%': { backgroundColor: 'transparent' },
  				'25%, 75%': { backgroundColor: 'hsl(var(--destructive) / 0.12)' }
  			},
  			/* Payment-processing overlay: a slow sonar ring so a several-second
  			   wait still reads as "working", not "frozen". */
  			'pay-ring': {
  				'0%': { transform: 'scale(0.7)', opacity: '0.5' },
  				'70%, 100%': { transform: 'scale(1.55)', opacity: '0' }
  			},
  			'pay-pop': {
  				'0%': { transform: 'scale(0.6)', opacity: '0' },
  				'60%': { transform: 'scale(1.08)', opacity: '1' },
  				'100%': { transform: 'scale(1)', opacity: '1' }
  			},
  			/* Fired when someone tries to close/refresh mid-payment — the card
  			   flinches so the warning is felt, not just printed. */
  			'pay-nudge': {
  				'0%, 100%': { transform: 'translateX(0)' },
  				'20%, 60%': { transform: 'translateX(-5px)' },
  				'40%, 80%': { transform: 'translateX(5px)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'row-leave': 'row-leave 0.28s ease-in forwards',
  			'row-enter': 'row-enter 0.28s ease-out',
  			'row-flash': 'row-flash 0.9s ease-in-out',
  			'pay-ring': 'pay-ring 2.4s cubic-bezier(0.24,0.6,0.3,1) infinite',
  			'pay-pop': 'pay-pop 0.42s cubic-bezier(0.2,1.2,0.35,1) both',
  			'pay-nudge': 'pay-nudge 0.42s ease-in-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
}
