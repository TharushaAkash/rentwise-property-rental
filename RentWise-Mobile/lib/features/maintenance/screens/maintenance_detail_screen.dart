
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../shared/theme/app_theme.dart';
import '../../../shared/utils/api_constants.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/maintenance_model.dart';
import '../providers/maintenance_provider.dart';


class MaintenanceDetailScreen extends ConsumerWidget {
  final MaintenanceModel model;

  const MaintenanceDetailScreen({super.key, required this.model});

  Future<void> _deleteRequest(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Request'),
        content: const Text('Are you sure you want to delete this maintenance request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true), 
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    
    if (confirm != true) return;

    try {
      final token = ref.read(authStateProvider).value?.token;
      final res = await http.delete(
        Uri.parse('${ApiConstants.baseUrl}/maintenance-requests/${model.id}'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 204 || res.statusCode == 200) {
        ref.invalidate(maintenanceProvider);
        if (context.mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request deleted successfully')));
        }
      } else {
        throw Exception('Failed to delete');
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Maintenance Center', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        backgroundColor: Colors.white,
        scrolledUnderElevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            onPressed: () => _deleteRequest(context, ref),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. TOP BREADCRUMB & ACTIONS
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Icon(Icons.arrow_back_rounded, size: 14, color: Colors.blue),
                const SizedBox(width: 4),
                const Text('Maintenance Center', style: TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                const Text('/', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                const SizedBox(width: 8),
                const Text('Tickets', style: TextStyle(color: AppColors.muted, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                const Text('/', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                const SizedBox(width: 8),
                Text('#${model.id.toString().substring(0, 8)}', style: const TextStyle(fontFamily: 'monospace', color: AppColors.ink, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Divider(height: 1, color: AppColors.line),
            ),

            // 2. EXECUTIVE HERO HEADER
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.line),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      // Category
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.blueGrey[50],
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.blueGrey[200]!),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('🛠️ ', style: TextStyle(fontSize: 12)),
                            Text(model.aiCategory.isNotEmpty ? model.aiCategory : 'General Issue', style: TextStyle(color: Colors.blueGrey[800], fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      // Priority
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: priorityBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: priorityColor.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (model.priority.toLowerCase() == 'high' || model.priority.toLowerCase() == 'emergency')
                              Icon(Icons.warning_rounded, size: 12, color: priorityColor)
                            else
                              Icon(Icons.flag_rounded, size: 12, color: priorityColor),
                            const SizedBox(width: 4),
                            Text('${model.priority.toUpperCase()} PRIORITY', style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                      // Status
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 6, height: 6, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
                            const SizedBox(width: 4),
                            Text(model.status.toUpperCase(), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Title
                  const Text('Maintenance Ticket Details', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink, height: 1.2)),
                  const SizedBox(height: 8),

                  // Ticket ID row
                  Row(
                    children: [
                      const Text('Ticket Reference: ', style: TextStyle(color: AppColors.muted, fontSize: 11, fontWeight: FontWeight.bold)),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(6)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  model.id.toString(),
                                  style: const TextStyle(fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.bold),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.copy, size: 10, color: AppColors.muted),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Property Details Box
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.canvas, borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.teal,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.home_rounded, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(model.propertyTitle, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink)),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 10, color: AppColors.muted),
                                  const SizedBox(width: 2),
                                  const Text('Colombo, Sri Lanka', style: TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),
                  
                  // Description
                  const Text('ISSUE DESCRIPTION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.muted, letterSpacing: 0.5)),
                  const SizedBox(height: 8),
                  Text(model.description, style: const TextStyle(fontSize: 14, color: AppColors.ink, height: 1.5)),

                  if (model.photoUrl.isNotEmpty) ...[
                    const SizedBox(height: 16),
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
                  ],

                  const SizedBox(height: 32),
                  const Text('PROGRESS TRACKING', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.muted, letterSpacing: 0.5)),
                  const SizedBox(height: 16),
                  _buildProgressTrack(model.status),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressTrack(String currentStatus) {
    final stages = [
      {'label': 'Ticket Submitted', 'desc': 'Ticket submitted and awaiting review.', 'status': 'Reported'},
      {'label': 'Technician Dispatched', 'desc': 'Technician assigned to evaluate/repair.', 'status': 'Assigned'},
      {'label': 'Repairs Underway', 'desc': 'Repairs underway at property.', 'status': 'In Progress'},
      {'label': 'Resolved', 'desc': 'Verified & resolved.', 'status': 'Completed'}
    ];
    
    int currentIndex = 0;
    switch (currentStatus.toLowerCase()) {
      case 'reported':
      case 'pending':
        currentIndex = 0;
        break;
      case 'assigned':
        currentIndex = 1;
        break;
      case 'in progress':
      case 'inprogress':
        currentIndex = 2;
        break;
      case 'completed':
        currentIndex = 3;
        break;
    }

    return Stack(
      children: [
        // The vertical connecting line
        Positioned(
          left: 11,
          top: 10,
          bottom: 10,
          child: Container(
            width: 2,
            color: AppColors.line,
          ),
        ),
        Column(
          children: List.generate(currentIndex + 1, (index) {
            // we reverse it so the latest is on top
            int actualIndex = currentIndex - index;
            bool isLatest = actualIndex == currentIndex;
            var stage = stages[actualIndex];

            return Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Circle Node
                  Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsets.only(top: 2),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isLatest ? Colors.blue[600]! : AppColors.line,
                        width: isLatest ? 3 : 2,
                      ),
                      boxShadow: isLatest ? [BoxShadow(color: Colors.blue.withValues(alpha: 0.2), blurRadius: 8, spreadRadius: 2)] : [],
                    ),
                    child: Center(
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: isLatest ? Colors.blue[600] : AppColors.muted,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header row
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Status Update',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.ink),
                                ),
                                if (isLatest) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue[50],
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(color: Colors.blue[100]!),
                                    ),
                                    child: Text('LATEST', style: TextStyle(color: Colors.blue[600], fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                                  ),
                                ]
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        
                        // Note Box
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
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: AppColors.line)),
                                    child: Text(actualIndex > 0 ? stages[actualIndex-1]['status']! : 'Draft', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.muted)),
                                  ),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 6),
                                    child: Text('→', style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.bold, fontSize: 12)),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: stage['status'] == 'Completed' ? Colors.green[50] : stage['status'] == 'In Progress' ? Colors.blue[50] : Colors.orange[50],
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: stage['status'] == 'Completed' ? Colors.green[200]! : stage['status'] == 'In Progress' ? Colors.blue[200]! : Colors.orange[200]!),
                                    ),
                                    child: Text(stage['status']!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: stage['status'] == 'Completed' ? Colors.green[800] : stage['status'] == 'In Progress' ? Colors.blue[800] : Colors.orange[800])),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(stage['desc']!, style: const TextStyle(fontSize: 13, color: AppColors.ink, fontWeight: FontWeight.w500, height: 1.4)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ),
      ],
    );
  }
}
