import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/providers/auth_provider.dart';
import '../properties/property_service.dart';
import '../properties/screens/properties_dashboard_screen.dart';

String _seenKey(String email) =>
    'booking_notifications_seen_${email.trim().toLowerCase()}';

class BookingNotificationBell extends ConsumerStatefulWidget {
  const BookingNotificationBell({super.key});
  @override
  ConsumerState<BookingNotificationBell> createState() =>
      _BookingNotificationBellState();
}

class _BookingNotificationBellState
    extends ConsumerState<BookingNotificationBell>
    with WidgetsBindingObserver {
  Timer? timer;
  List<Map<String, dynamic>> notifications = [];
  Set<String> seen = {}, known = {};
  bool loaded = false, fetching = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refresh();
    timer = Timer.periodic(const Duration(seconds: 20), (_) => refresh());
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  Future<void> refresh() async {
    if (fetching ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.paused)
      return;
    fetching = true;
    final user = ref.read(authStateProvider).value;
    if (user == null || !isOwner(user.role)) {
      fetching = false;
      return;
    }
    try {
      final data = await ref
          .read(propertyServiceProvider)
          .request('GET', '/property-applications');
      final prefs = await SharedPreferences.getInstance();
      final read = (prefs.getStringList(_seenKey(user.email)) ?? []).toSet();
      final list = (data as List)
          .map((a) => Map<String, dynamic>.from(a))
          .where((a) => a['ownerId'] == user.id)
          .toList();
      if (!mounted || ref.read(authStateProvider).value?.id != user.id) return;
      final fresh = list
          .where(
            (a) =>
                !known.contains(a['id'].toString()) &&
                !read.contains(a['id'].toString()),
          )
          .toList();
      if (loaded && fresh.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'New booking: ${fresh.first['propertyTitle'] ?? "your property"}',
            ),
            action: SnackBarAction(label: 'View', onPressed: open),
          ),
        );
        ref.invalidate(applicationsProvider);
      }
      setState(() {
        notifications = list;
        seen = read;
        known = list.map((a) => a['id'].toString()).toSet();
        loaded = true;
      });
    } catch (_) {
      /* Keep the existing inbox during a temporary connection failure. */
    } finally {
      fetching = false;
    }
  }

  Future<void> open() async {
    final user = ref.read(authStateProvider).value;
    if (user == null) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BookingNotificationsScreen(email: user.email),
      ),
    );
    if (mounted) refresh();
  }

  @override
  Widget build(BuildContext context) {
    final count = notifications
        .where((a) => !seen.contains(a['id'].toString()))
        .length;
    return IconButton(
      tooltip: 'Booking notifications',
      onPressed: open,
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text('$count'),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}

class BookingNotificationsScreen extends ConsumerStatefulWidget {
  const BookingNotificationsScreen({super.key, required this.email});
  final String email;
  @override
  ConsumerState<BookingNotificationsScreen> createState() =>
      _BookingNotificationsScreenState();
}

class _BookingNotificationsScreenState
    extends ConsumerState<BookingNotificationsScreen> {
  List<Map<String, dynamic>>? items;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final user = ref.read(authStateProvider).value;
      if (user == null || user.email != widget.email) return;
      final data = await ref
          .read(propertyServiceProvider)
          .request('GET', '/property-applications');
      final list = (data as List)
          .map((a) => Map<String, dynamic>.from(a))
          .where((a) => a['ownerId'] == user.id)
          .toList();
      final prefs = await SharedPreferences.getInstance();
      final previous = (prefs.getStringList(_seenKey(widget.email)) ?? [])
          .toSet();
      previous.addAll(list.map((a) => a['id'].toString()));
      await prefs.setStringList(_seenKey(widget.email), previous.toList());
      if (mounted && ref.read(authStateProvider).value?.id == user.id)
        setState(() {
          items = list;
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Booking notifications'),
      actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
    ),
    body: error != null
        ? Center(child: Text(error!))
        : items == null
        ? const Center(child: CircularProgressIndicator())
        : items!.isEmpty
        ? const Center(child: Text('No booking notifications yet.'))
        : RefreshIndicator(
            onRefresh: load,
            child: ListView(
              children: items!
                  .map(
                    (a) => ListTile(
                      leading: const Icon(Icons.calendar_month),
                      title: Text(
                        a['propertyTitle']?.toString() ?? 'New booking',
                      ),
                      subtitle: Text(
                        '${a['tenantName'] ?? "Tenant"} - ${a['status'] ?? "Submitted"}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const PropertyBookingsScreen(),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
  );
}
