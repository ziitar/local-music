import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/colors.dart';
import '../player/player_bar.dart';

/// Main app shell with bottom navigation and player bar.
class AppShell extends StatelessWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: child),
          const PlayerBar(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex(context),
        onDestinationSelected: (index) => _onTap(context, index),
        backgroundColor: colors.surface,
        indicatorColor: colors.primary.withValues(alpha: 0.2),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: colors.primary),
            label: '首页',
          ),
          NavigationDestination(
            icon: const Icon(Icons.library_music_outlined),
            selectedIcon: Icon(Icons.library_music, color: colors.primary),
            label: '曲库',
          ),
          NavigationDestination(
            icon: const Icon(Icons.search_outlined),
            selectedIcon: Icon(Icons.search, color: colors.primary),
            label: '搜索',
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings, color: colors.primary),
            label: '设置',
          ),
        ],
      ),
    );
  }

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location == '/') return 0;
    if (location == '/library') return 1;
    if (location == '/search') return 2;
    if (location == '/settings') return 3;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0: context.go('/'); break;
      case 1: context.go('/library'); break;
      case 2: context.go('/search'); break;
      case 3: context.go('/settings'); break;
    }
  }
}
