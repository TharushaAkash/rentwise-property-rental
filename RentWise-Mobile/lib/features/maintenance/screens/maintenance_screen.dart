import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/theme/app_theme.dart';
import '../providers/maintenance_provider.dart';
import '../models/maintenance_model.dart';
import 'maintenance_detail_screen.dart';
import 'create_maintenance_screen.dart';
import 'package:intl/intl.dart';

class MaintenanceScreen extends ConsumerWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenanceAsync = ref.watch(maintenanceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Maintenance Requests', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
      ),
      body: maintenanceAsync.when(
        data: (requests) {
          if (requests.isEmpty) {
            return const Center(child: Text('No maintenance requests found.'));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(maintenanceProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              itemCount: requests.length,
              itemBuilder: (context, index) {
                return _buildMaintenanceCard(context, requests[index]);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Failed to load requests: $err', style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () => ref.refresh(maintenanceProvider.future),
                child: const Text('Retry'),
              )
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateMaintenanceScreen()));
        },
        backgroundColor: AppColors.teal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildMaintenanceCard(BuildContext context, MaintenanceModel model) {
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

    Color priorityColor = model.priority.toLowerCase() == 'high'
        ? AppColors.rose
        : model.priority.toLowerCase() == 'medium'
            ? Colors.orange
            : AppColors.teal;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
        boxShadow: const [
          BoxShadow(color: Color(0x08000000), blurRadius: 8, offset: Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      model.propertyTitle,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.ink),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded, size: 12, color: AppColors.muted),
                        const SizedBox(width: 4),
                        Text(DateFormat.yMMMd().format(model.createdAt), style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 12, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      model.status,
                      style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.line),
          ),
          Text(
            model.description,
            style: const TextStyle(color: AppColors.ink, fontSize: 14, height: 1.4),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('Priority: ', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                  Text(
                    model.priority,
                    style: TextStyle(color: priorityColor, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => MaintenanceDetailScreen(model: model),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Text(
                    'View Details',
                    style: TextStyle(color: AppColors.teal, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
