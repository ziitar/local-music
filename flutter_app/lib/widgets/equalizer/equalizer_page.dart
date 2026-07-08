import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/colors.dart';
import '../../theme/text_styles.dart';
import '../../models/eq_preset.dart';
import '../../services/equalizer_service.dart';
import 'eq_band_slider.dart';

/// Equalizer page with preset selector and band sliders.
class EqualizerPage extends ConsumerStatefulWidget {
  const EqualizerPage({super.key});

  @override
  ConsumerState<EqualizerPage> createState() => _EqualizerPageState();
}

class _EqualizerPageState extends ConsumerState<EqualizerPage> {
  final _eq = EqualizerService();
  bool _enabled = false;
  String _selectedPreset = 'flat';
  List<double> _gains = List.filled(10, 0.0);

  @override
  void initState() {
    super.initState();
    _enabled = _eq.enabled;
    _selectedPreset = _eq.currentPreset;
    _gains = List.from(_eq.gains);
  }

  Future<void> _toggleEnabled(bool value) async {
    await _eq.setEnabled(value);
    setState(() => _enabled = value);
  }

  Future<void> _selectPreset(String name) async {
    await _eq.applyPreset(name);
    setState(() {
      _selectedPreset = name;
      _gains = List.from(_eq.gains);
    });
  }

  Future<void> _setBandGain(int index, double gain) async {
    await _eq.setBandGain(index, gain);
    setState(() {
      _gains = List.from(_eq.gains);
      _selectedPreset = _eq.currentPreset;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('均衡器'),
        actions: [
          Switch(
            value: _enabled,
            onChanged: _toggleEnabled,
            activeThumbColor: colors.primary,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Preset selector
          _buildPresetSelector(),
          const Divider(height: 1),
          // Band sliders
          Expanded(
            child: _enabled
                ? _buildBandSliders()
                : Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.equalizer,
                          size: 64,
                          color: colors.textTertiary.withValues(alpha: 0.3),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '均衡器已关闭',
                          style: AppTextStyles.bodyMedium(context).copyWith(
                            color: colors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetSelector() {
    final colors = AppColors.of(context);
    return Container(
      height: 80,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: EqPresets.all.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final preset = EqPresets.all[index];
          final isSelected = _selectedPreset == preset.name;

          return GestureDetector(
            onTap: () => _selectPreset(preset.name),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? colors.primary.withValues(alpha: 0.2)
                    : colors.surfaceVariant,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? colors.primary : colors.divider,
                  width: isSelected ? 2 : 1,
                ),
              ),
              child: Center(
                child: Text(
                  preset.label,
                  style: TextStyle(
                    color: isSelected ? colors.primary : colors.textSecondary,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBandSliders() {
    final bands = _eq.getBands();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // dB scale labels
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('+12 dB', style: AppTextStyles.bodySmall(context)),
                Text('0 dB', style: AppTextStyles.bodySmall(context)),
                Text('-12 dB', style: AppTextStyles.bodySmall(context)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Band sliders
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(bands.length, (i) {
                return EqBandSlider(
                  label: bands[i].frequencyLabel,
                  value: _gains.length > i ? _gains[i] : 0.0,
                  onChanged: (v) => _setBandGain(i, v),
                );
              }),
            ),
          ),
          const SizedBox(height: 16),
          // Reset button
          TextButton.icon(
            onPressed: () => _selectPreset('flat'),
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('重置'),
          ),
        ],
      ),
    );
  }
}
