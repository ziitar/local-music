import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../models/eq_preset.dart';
import '../providers/auth_provider.dart';
import '../providers/player_provider.dart';
import '../providers/providers.dart';
import '../providers/settings_provider.dart';
import '../services/equalizer_service.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final player = ref.watch(playerProvider);
    final storage = ref.watch(storageServiceProvider);
    final settings = ref.watch(playbackSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        children: [
          // User info
          if (auth.user != null)
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Icon(Icons.person, color: Colors.white),
              ),
              title: Text(auth.user!.username, style: AppTextStyles.titleMedium),
              subtitle: Text(auth.user!.role, style: AppTextStyles.bodySmall),
            ),
          const Divider(),

          // Server
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text('服务器', style: AppTextStyles.labelLarge),
          ),
          ListTile(
            leading: const Icon(Icons.dns),
            title: const Text('服务器地址'),
            subtitle: Text(storage.serverUrl ?? '未配置'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: show server config dialog
            },
          ),

          // Playback
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Text('播放', style: AppTextStyles.labelLarge),
          ),
          ListTile(
            leading: const Icon(Icons.high_quality),
            title: const Text('音质'),
            subtitle: Text(player.quality ?? '原始'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showQualityPicker(context, ref),
          ),

          // Equalizer toggle
          SwitchListTile(
            secondary: const Icon(Icons.equalizer),
            title: const Text('均衡器'),
            subtitle: const Text('关闭时音频不经过均衡器处理'),
            value: settings.eqEnabled,
            activeThumbColor: AppColors.primary,
            onChanged: (value) {
              ref.read(playbackSettingsProvider.notifier).setEqEnabled(value);
              EqualizerService().setEnabled(value);
            },
          ),

          // Equalizer preset selector (visible when EQ enabled)
          if (settings.eqEnabled) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              child: SizedBox(
                height: 42,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: EqPresets.all.map((preset) {
                    final isSelected = settings.eqPresetName == preset.name;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(preset.label),
                        selected: isSelected,
                        selectedColor: AppColors.primary,
                        onSelected: (_) {
                          ref.read(playbackSettingsProvider.notifier)
                              .setEqPreset(preset.name);
                          EqualizerService().applyPreset(preset.name);
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            ListTile(
              leading: const SizedBox(width: 24),
              title: const Text('详细均衡器'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/equalizer'),
            ),
          ],

          // Loudness normalization toggle
          SwitchListTile(
            secondary: const Icon(Icons.volume_up),
            title: const Text('响度归一化'),
            subtitle: const Text('自动调整音量，使不同歌曲响度一致'),
            value: settings.loudnessNormalizationEnabled,
            activeThumbColor: AppColors.primary,
            onChanged: (value) {
              ref.read(playbackSettingsProvider.notifier)
                  .setLoudnessNormalization(value);
            },
          ),

          // About
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Text('关于', style: AppTextStyles.labelLarge),
          ),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('版本'),
            subtitle: Text('1.0.0'),
          ),

          // Logout
          const Divider(),
          Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
              icon: const Icon(Icons.logout, color: AppColors.error),
              label: const Text('退出登录', style: TextStyle(color: AppColors.error)),
            ),
          ),
        ],
      ),
    );
  }

  void _showQualityPicker(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => _QualitySheet(),
    );
  }
}

class _QualitySheet extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(playerProvider).quality;

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('选择音质', style: AppTextStyles.titleLarge),
          ),
          _buildOption(context, ref, '原始', null, current),
          _buildOption(context, ref, '无损', 'lossless', current),
          _buildOption(context, ref, '320K', '320', current),
          _buildOption(context, ref, '192K', '192', current),
          _buildOption(context, ref, '128K', '128', current),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildOption(BuildContext context, WidgetRef ref, String label, String? value, String? current) {
    final isSelected = current == value;
    return ListTile(
      title: Text(label),
      trailing: isSelected ? const Icon(Icons.check, color: AppColors.primary) : null,
      onTap: () {
        ref.read(playerProvider.notifier).setQuality(value);
        Navigator.pop(context);
      },
    );
  }
}
