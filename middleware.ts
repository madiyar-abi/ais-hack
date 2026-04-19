import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Игнорируем логин, лендинг, статику, картинки
  if (
    pathname === '/' || 
    pathname.startsWith('/login') || 
    pathname.startsWith('/api') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = String(payload.role || '');

    // Если запрошен корневой урл, редиректим в зависимости от роли
    if (pathname === '/') {
      if (role === 'director' || role === 'deputy') {
        return NextResponse.redirect(new URL('/dashboard/admin', request.url));
      } else if (role === 'teacher') {
        return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
      } else {
        // Fallback
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Защита Admin зоны:
    if (pathname.startsWith('/dashboard/admin') && role !== 'director' && role !== 'deputy') {
      return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
    }

    // Защита Teacher зоны: (director тоже может смотреть? пусть пока будет строгий fallback)
    if (pathname.startsWith('/dashboard/teacher') && role !== 'teacher') {
       if (role === 'director' || role === 'deputy') {
         // разрешим директору смотреть учительский дашборд
       } else {
         return NextResponse.redirect(new URL('/login', request.url));
       }
    }

    return NextResponse.next();
  } catch (err) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api).*)'],
};
