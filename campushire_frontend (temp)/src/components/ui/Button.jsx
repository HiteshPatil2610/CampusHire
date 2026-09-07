export default function Button({
  variant = 'primary', // primary | outline | ghost | danger
  size, // 'sm' | undefined
  className = '',
  children,
  ...rest
}) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
