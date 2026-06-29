import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../services/visualizer_service.dart';
import 'visualizer_painter.dart';

/// Three-wave warm-color band visualizer widget.
///
/// Uses flutter_soloud for FFT data and CustomPainter for rendering.
/// Designed to be shown in the song detail page (swipe left from cover).
class WaveVisualizer extends StatefulWidget {
  const WaveVisualizer({super.key});

  @override
  State<WaveVisualizer> createState() => _WaveVisualizerState();
}

class _WaveVisualizerState extends State<WaveVisualizer>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  final _visualizer = VisualizerService();
  FftBandData _bandData = FftBandData.empty;
  double _animationValue = 0.0;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    _ticker.start();
    _initVisualizer();
  }

  Future<void> _initVisualizer() async {
    final success = await _visualizer.init();
    if (mounted) {
      setState(() => _initialized = success);
    }
  }

  void _onTick(Duration elapsed) {
    if (!mounted || !_initialized) return;

    try {
      // Update FFT data from flutter_soloud
      _visualizer.updateSamples();
      final data = _visualizer.getBandData();

      // Advance animation (continuous smooth cycle)
      final seconds = elapsed.inMicroseconds / 1000000.0;
      final animValue = (seconds * 0.5) % 1.0; // 2 second full cycle

      setState(() {
        _bandData = data;
        _animationValue = animValue;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _ticker.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: WaveVisualizerPainter(
            bandData: _bandData,
            animationValue: _animationValue,
          ),
        ),
      ),
    );
  }
}
