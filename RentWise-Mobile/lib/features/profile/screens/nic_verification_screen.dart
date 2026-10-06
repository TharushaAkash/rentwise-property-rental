import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../properties/property_service.dart';
import 'edit_profile_screen.dart';

class NicVerificationScreen extends ConsumerStatefulWidget {
  const NicVerificationScreen({super.key});
  @override
  ConsumerState<NicVerificationScreen> createState() =>
      _NicVerificationScreenState();
}

class _NicVerificationScreenState extends ConsumerState<NicVerificationScreen> {
  Uint8List? bytes;
  String? filename, message;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => refreshStatus());
  }

  Future<void> refreshStatus() async {
    if (!mounted || !isOwner(ref.read(authStateProvider).value?.role)) return;
    try {
      await ref.read(authStateProvider.notifier).refreshProfile();
    } catch (_) {
      if (mounted)
        setState(
          () =>
              message = 'Could not refresh your NIC status. Please try again.',
        );
    }
  }

  Future<void> pick() async {
    if (!isOwner(ref.read(authStateProvider).value?.role)) return;
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      );
      if (files.isEmpty) return;
      final file = files.first;
      if ((await file.length() ?? 0) > 10 * 1024 * 1024)
        throw Exception('Choose an image smaller than 10 MB.');
      final content = await file.readAsBytes();
      if (content.length > 10 * 1024 * 1024)
        throw Exception('Choose an image smaller than 10 MB.');
      if (mounted)
        setState(() {
          bytes = content;
          filename = file.name;
          message = null;
        });
    } catch (e) {
      if (mounted) setState(() => message = e.toString());
    }
  }

  Future<void> upload() async {
    final user = ref.read(authStateProvider).value;
    if (user == null ||
        !isOwner(user.role) ||
        bytes == null ||
        filename == null)
      return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      final data = await ref
          .read(propertyServiceProvider)
          .upload('/auth/${user.id}/verify-nic', bytes!, filename!, {});
      await ref.read(authStateProvider.notifier).refreshProfile();
      if (mounted)
        setState(
          () => message = data['isNicVerified'] == true
              ? 'Your NIC is verified.'
              : (data['message']?.toString() ??
                    'The image was uploaded, but verification was not successful. Try a clear image matching your NIC number.'),
        );
    } catch (e) {
      if (mounted) setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).value;
    if (!isOwner(user?.role)) {
      return Scaffold(
        appBar: AppBar(title: const Text('NIC verification')),
        body: const Center(
          child: Text('NIC upload is available to property owners only.'),
        ),
      );
    }
    final uploaded = user?.nicImageUrl?.trim().isNotEmpty == true;
    return Scaffold(
      appBar: AppBar(
        title: const Text('NIC verification'),
        actions: [
          IconButton(
            tooltip: 'Refresh NIC status',
            onPressed: busy ? null : refreshStatus,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ListTile(
            leading: Icon(
              user?.isNicVerified == true
                  ? Icons.verified
                  : Icons.badge_outlined,
            ),
            title: Text(
              user?.isNicVerified == true
                  ? 'Verified'
                  : 'Verification required',
            ),
            subtitle: Text('NIC: ${user?.nicNumber ?? "Not provided"}'),
          ),
          ListTile(
            leading: Icon(
              uploaded ? Icons.check_circle_outline : Icons.upload_file,
            ),
            title: Text(
              uploaded
                  ? 'NIC image already uploaded'
                  : 'No NIC image uploaded yet',
            ),
            subtitle: Text(
              user?.isNicVerified == true
                  ? 'Verification successful'
                  : uploaded
                  ? 'Uploaded image is not verified'
                  : 'Upload your NIC to start verification',
            ),
          ),
          if (uploaded && bytes == null) ...[
            const Text('Previously uploaded NIC'),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                user!.nicImageUrl!,
                height: 200,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('NIC image is uploaded. Preview is unavailable.'),
                ),
              ),
            ),
          ],
          TextButton(
            onPressed: busy
                ? null
                : () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const EditProfileScreen(),
                    ),
                  ),
            child: const Text('Edit NIC number'),
          ),
          const Text(
            'Choose a clear photo of your NIC. The number must match your profile.',
          ),
          const SizedBox(height: 20),
          if (bytes != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.memory(bytes!, height: 200, fit: BoxFit.contain),
            ),
          if (filename != null) Text(filename!),
          OutlinedButton.icon(
            onPressed: busy ? null : pick,
            icon: const Icon(Icons.upload_file),
            label: Text(
              uploaded ? 'Choose replacement NIC image' : 'Choose NIC image',
            ),
          ),
          FilledButton(
            onPressed:
                busy || bytes == null || user?.nicNumber?.isNotEmpty != true
                ? null
                : upload,
            child: Text(
              busy ? 'Uploading and verifying...' : 'Upload and verify NIC',
            ),
          ),
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(message!),
            ),
        ],
      ),
    );
  }
}
