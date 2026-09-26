import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/theme/app_theme.dart';
import '../providers/maintenance_provider.dart';
import '../models/maintenance_model.dart';
import 'maintenance_detail_screen.dart';
import 'create_maintenance_screen.dart';
import 'package:intl/intl.dart';
import '../../auth/providers/auth_provider.dart';

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
                return _buildMaintenanceCard(context, ref, requests[index]);
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

  Widget _buildMaintenanceCard(BuildContext context, WidgetRef ref, MaintenanceModel model) {
    final user = ref.watch(authStateProvider).value;
    final userName = user?.name ?? 'Tenant Resident';
    final userEmail = user?.email ?? 'tenant@rentwise.lk';
    final userInitials = userName.isNotEmpty ? userName.substring(0, 1).toUpperCase() : 'T';
    Color statusColor;
    Color statusBg;

    switch (model.status.toLowerCase()) {
      case 'reported':
      case 'pending':
        statusColor = Colors.orange[800]!;
        statusBg = Colors.orange[50]!;
        break;
      case 'assigned':
      case 'in progress':
      case 'inprogress':
        statusColor = Colors.blue[800]!;
        statusBg = Colors.blue[50]!;
        break;
      case 'completed':
      default:
        statusColor = AppColors.teal;
        statusBg = AppColors.softTeal;
        break;
    }

    Color priorityColor;
    Color priorityBg;
    switch (model.priority.toLowerCase()) {
      case 'high':
      case 'emergency':
      case 'urgent':
        priorityColor = AppColors.rose;
        priorityBg = Colors.red[50]!;
        break;
      case 'medium':
        priorityColor = Colors.orange[800]!;
        priorityBg = Colors.orange[50]!;
        break;
      default:
        priorityColor = AppColors.teal;
        priorityBg = AppColors.softTeal;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Image Banner with Overlays
          GestureDetector(
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => MaintenanceDetailScreen(model: model)));
            },
            child: SizedBox(
              height: 180,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Image
                  Image.network(
                    model.photoUrl.isNotEmpty ? model.photoUrl : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      color: AppColors.canvas,
                      child: const Icon(Icons.broken_image_rounded, color: AppColors.muted, size: 40),
                    ),
                  ),
                  // Gradient Overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.8),
                          Colors.black.withValues(alpha: 0.3),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                  // Top-Left Category
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🛠️ ', style: TextStyle(fontSize: 12)),
                          Text(model.aiCategory.isNotEmpty ? model.aiCategory : 'General Issue', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                  // Top-Right Priority
                  Positioned(
                    top: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: priorityBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: priorityColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        model.priority,
                        style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  // Bottom Property Info
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          model.propertyTitle,
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        const Row(
                          children: [
                            Icon(Icons.location_on_rounded, color: AppColors.teal, size: 12),
                            SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                'Colombo, Sri Lanka',
                                style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // 2. Card Body
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Issue Description Box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'ISSUE REPORTED',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 0.5),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: statusBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  model.status,
                                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        model.description,
                        style: const TextStyle(color: AppColors.ink, fontSize: 13, fontWeight: FontWeight.w700, height: 1.4),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (model.photoUrl.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(Icons.image_rounded, size: 12, color: Colors.blue[600]),
                            const SizedBox(width: 4),
                            Text('Tenant photo attached', style: TextStyle(color: Colors.blue[600], fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Tenant / Date Row
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Colors.indigo, Colors.blueGrey]),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(userInitials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(userName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.ink)),
                          const SizedBox(height: 2),
                          Text(userEmail, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1, color: AppColors.line),
                ),
                
                // Footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded, size: 12, color: AppColors.muted),
                        const SizedBox(width: 4),
                        Text(
                          'Reported: ${DateFormat.yMMMd().format(model.createdAt)}',
                          style: const TextStyle(color: AppColors.muted, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    InkWell(
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => MaintenanceDetailScreen(model: model)));
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.softTeal,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Text(
                              'View Details',
                              style: TextStyle(color: AppColors.teal, fontWeight: FontWeight.w800, fontSize: 12),
                            ),
                            SizedBox(width: 4),
                            Icon(Icons.arrow_forward_rounded, size: 12, color: AppColors.teal),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
