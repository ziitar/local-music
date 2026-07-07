import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import 'providers.dart';

/// Auth state.
class AuthState {
  final User? user;
  final bool isLoading;
  final bool isRestoring;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.isRestoring = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({User? user, bool? isLoading, bool? isRestoring, String? error}) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      isRestoring: isRestoring ?? this.isRestoring,
      error: error,
    );
  }
}

/// Auth state notifier.
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(const AuthState(isRestoring: true)) {
    _restoreSession();
  }

  /// Restore session from persisted tokens on app startup.
  Future<void> _restoreSession() async {
    try {
      final user = await _api.me();
      state = AuthState(user: user);
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> checkAuth() async {
    try {
      final user = await _api.me();
      state = AuthState(user: user);
      return true;
    } catch (_) {
      state = const AuthState();
      return false;
    }
  }

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _api.login(username, password);
      if (result.user != null) {
        state = AuthState(user: result.user);
        return true;
      }
      final user = await _api.me();
      state = AuthState(user: user);
      return true;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<bool> register(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _api.register(username, password);
      if (result.user != null) {
        state = AuthState(user: result.user);
        return true;
      }
      final user = await _api.me();
      state = AuthState(user: user);
      return true;
    } catch (e) {
      state = AuthState(error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await _api.logout();
    state = const AuthState();
  }
}

/// Auth provider.
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});
