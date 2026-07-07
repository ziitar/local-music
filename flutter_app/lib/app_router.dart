import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/auth_provider.dart';
import 'pages/home_page.dart';
import 'pages/library_page.dart';
import 'pages/artists_page.dart';
import 'pages/artist_detail_page.dart';
import 'pages/albums_page.dart';
import 'pages/album_detail_page.dart';
import 'pages/playlists_page.dart';
import 'pages/playlist_detail_page.dart';
import 'pages/search_page.dart';
import 'pages/song_detail_page.dart';
import 'pages/settings_page.dart';
import 'widgets/equalizer/equalizer_page.dart';
import 'pages/login_page.dart';
import 'pages/register_page.dart';
import 'widgets/layout/app_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      // While restoring session from persisted tokens, block all navigation.
      if (auth.isRestoring) {
        return state.matchedLocation == '/login' ? null : '/login';
      }

      final isLoggedIn = auth.isAuthenticated;
      final isLoginRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';
      final isSetupRoute = state.matchedLocation == '/setup';

      if (!isLoggedIn && !isLoginRoute && !isSetupRoute) {
        return '/login';
      }
      if (isLoggedIn && isLoginRoute) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/', pageBuilder: (context, state) => const NoTransitionPage(child: HomePage())),
          GoRoute(path: '/library', pageBuilder: (context, state) => const NoTransitionPage(child: LibraryPage())),
          GoRoute(path: '/search', pageBuilder: (context, state) => const NoTransitionPage(child: SearchPage())),
          GoRoute(path: '/settings', pageBuilder: (context, state) => const NoTransitionPage(child: SettingsPage())),
        ],
      ),
      GoRoute(path: '/artists', builder: (context, state) => const ArtistsPage()),
      GoRoute(path: '/artists/:id', builder: (context, state) => ArtistDetailPage(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/albums', builder: (context, state) => const AlbumsPage()),
      GoRoute(path: '/albums/:id', builder: (context, state) => AlbumDetailPage(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/playlists', builder: (context, state) => const PlaylistsPage()),
      GoRoute(path: '/playlists/:id', builder: (context, state) => PlaylistDetailPage(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/song/:id', builder: (context, state) => SongDetailPage(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/equalizer', builder: (context, state) => const EqualizerPage()),
    ],
  );
});
