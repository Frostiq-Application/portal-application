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
  			},
  			/* Floor kanban. Every card keeps a small resting tilt in `--tilt`,
  			   so each keyframe has to carry it through — animating `transform`
  			   without it would snap the card straight mid-flight. */
  			'card-in': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(10px) scale(0.96) rotate(var(--tilt, 0deg))'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0) scale(1) rotate(var(--tilt, 0deg))'
  				}
  			},
  			/* Played once where a dragged card comes to rest — the overshoot is
  			   what makes a drop feel like it landed rather than teleported. */
  			'card-land': {
  				'0%': {
  					transform: 'scale(1.07) rotate(calc(var(--tilt, 0deg) - 3deg))'
  				},
  				'45%': {
  					transform: 'scale(0.975) rotate(calc(var(--tilt, 0deg) + 1.5deg))'
  				},
  				'100%': { transform: 'scale(1) rotate(var(--tilt, 0deg))' }
  			},
  			/* Dropped somewhere the pipeline doesn't allow. */
  			'card-deny': {
  				'0%, 100%': {
  					transform: 'translateX(0) rotate(var(--tilt, 0deg))'
  				},
  				'20%, 60%': {
  					transform: 'translateX(-7px) rotate(calc(var(--tilt, 0deg) - 2deg))'
  				},
  				'40%, 80%': {
  					transform: 'translateX(7px) rotate(calc(var(--tilt, 0deg) + 2deg))'
  				}
  			},
  			'lane-pulse': {
  				'0%, 100%': { transform: 'scale(1)', opacity: '1' },
  				'50%': { transform: 'scale(1.05)', opacity: '0.9' }
  			},
  			/* Boot splash. The mark breathes rather than spins — a spinner says
  			   "waiting", a slow rise and fall says "warming up". */
  			'splash-bob': {
  				'0%, 100%': { transform: 'translateY(0) scale(1)' },
  				'50%': { transform: 'translateY(-6px) scale(1.02)' }
  			},
  			/* Rings leaving the mark, so a slow first load still reads as
  			   working rather than stalled. */
  			'splash-ring': {
  				'0%': { transform: 'scale(0.85)', opacity: '0.45' },
  				'70%, 100%': { transform: 'scale(1.45)', opacity: '0' }
  			},
  			/* Indeterminate track — movement without a fabricated percentage. */
  			'splash-track': {
  				'0%': { transform: 'translateX(-100%)' },
  				'100%': { transform: 'translateX(300%)' }
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
  			'pay-nudge': 'pay-nudge 0.42s ease-in-out',
  			/* `backwards`, never `forwards`: a filled-forwards animation keeps
  			   winning the cascade after it ends, which would freeze the card's
  			   transform and make it undraggable. */
  			'card-in': 'card-in 0.34s cubic-bezier(0.2,0.8,0.3,1) backwards',
  			'card-land': 'card-land 0.5s cubic-bezier(0.2,1.1,0.35,1)',
  			'card-deny': 'card-deny 0.4s ease-in-out',
  			'lane-pulse': 'lane-pulse 1.2s ease-in-out infinite',
  			'splash-bob': 'splash-bob 2.6s ease-in-out infinite',
  			'splash-ring': 'splash-ring 2.6s cubic-bezier(0.24,0.6,0.3,1) infinite',
  			'splash-track': 'splash-track 1.5s ease-in-out infinite'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
}
