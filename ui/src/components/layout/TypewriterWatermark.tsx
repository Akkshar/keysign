import React from 'react';

export const TypewriterWatermark: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      data-purpose="ambient-watermark-wrapper"
    >
      <img
        alt="Atmospheric vintage mechanical typewriter background watermark"
        className="opacity-25 dark:opacity-10 mix-blend-multiply dark:mix-blend-screen filter blur-[0.5px] pointer-events-none absolute right-[-6%] -top-12 w-[60%] h-auto max-h-[660px] object-cover object-left mask-fade animate-gentle-drift select-none"
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvoiBIlUilUZAIWPYgzgdgfUVcu5vU-_OA_xUDk72kxZAavmM6Xuio02iDy8VJGmhUBf9Tm2iRl7qrD-bm0CAkaJQ7dMyb12y0yvxd1YmcACpR_KxOUbb3bh5xVwuXkx1XgyQ4PT9vHunwx2w4btUgKZw96okP56ueEZfOjz5A7Mz2jPrGOrZNENoZh1sj_glP1LSN_i3QjYb0hQ1P9S-TCl1mArZ_fsAwqQUyjpHcDoY4eGbh-wNKLg"
      />
    </div>
  );
};
