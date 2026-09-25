import 'package:flutter/material.dart';
import '../../shared/theme/app_theme.dart';
import '../models/maintenance_model.dart';
import 'package:intl/intl.dart';

class MaintenanceDetailScreen extends StatelessWidget {
  final MaintenanceModel model;

  const MaintenanceDetailScreen({super.key, required this.model});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    Color statusBg;
    IconData statusIcon;

    switch (model.status.toLowerCase()) {
      case 'reported':
      case 'pending':
        statusColor = Colors.orange[800]!;
        statusBg = Colors.orange[50]!;
        statusIcon = Icons.hourglass_top_rounded;
        break;
      case 'assigned':
      case 'in progress':
      case 'inprogress':
        statusColor = Colors.blue[800]!;
        statusBg = Colors.blue[50]!;
        statusIcon = Icons.autorenew_rounded;
        break;
      case 'completed':
      default:
        statusColor = AppColors.teal;
        statusBg = AppColors.softTeal;
        statusIcon = Icons.check_circle_outline_rounded;
        break;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Details', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (model.photoUrl.isNotEmpty) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  model.photoUrl,
                  width: double.infinity,
                  height: 200,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Container(
                    width: double.infinity,
                    height: 200,
                    color: AppColors.line,
                    child: const Icon(Icons.broken_image_rounded, color: AppColors.muted, size: 40),
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: statusColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(statusIcon, size: 16, color: statusColor),
                  const SizedBox(width: 6),
                  Text(
                    model.status,
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              model.propertyTitle,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: AppColors.ink),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.muted),
                const SizedBox(width: 6),
                Text(
                  'Reported on ${DateFormat.yMMMd().format(model.createdAt)}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text('Description', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink)),
            const SizedBox(height: 8),
            Text(
              model.description,
              style: const TextStyle(color: AppColors.ink, fontSize: 15, height: 1.5),
            ),
            const SizedBox(height: 24),
            const Text('AI Priority', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink)),
            const SizedBox(height: 8),
            Text(
              model.priority,
              style: TextStyle(
                color: model.priority.toLowerCase() == 'high'
                    ? AppColors.rose
                    : model.priority.toLowerCase() == 'medium'
                        ? Colors.orange[800]
                        : AppColors.teal,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
