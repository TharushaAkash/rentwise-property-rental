import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../properties/property_service.dart';
import '../properties/screens/property_detail_screen.dart';
import '../shared/theme/app_theme.dart';
import '../shared/widgets/modern_ui.dart';
import '../rentals/screens/my_rentals_screen.dart';
import 'workflow_service.dart';

const requestStatuses = {
  'Ready': 'Getting ready',
  'Executing': 'Preparing your proposal',
  'Failed': 'Needs attention',
  'AwaitingApproval': 'Awaiting owner review',
  'Completed': 'Draft approved',
  'RevisionRequested': 'Changes requested',
  'Rejected': 'Not approved',
};
const preparationLabels = {
  'MatchingLocation': 'Finding your home',
  'PropertyVerification': 'Checking availability',
  'AgreementPricing': 'Preparing your agreement',
  'MaintenanceTriage': 'Planning your move-in',
};
String _date(dynamic value) =>
    DateFormat('d MMM yyyy').format(DateTime.parse(value.toString()).toLocal());
String _money(dynamic value) =>
    'LKR ${NumberFormat('#,##0.##').format(num.tryParse('$value') ?? 0)}';
String _error(Object e) => e is WorkflowException
    ? e.message
    : 'Connection interrupted. Refresh to check saved progress before trying again.';

class RentalRequestsScreen extends StatefulWidget {
  final bool canCreate;
  final WorkflowService? service;
  const RentalRequestsScreen({
    super.key,
    required this.canCreate,
    this.service,
  });
  @override
  State<RentalRequestsScreen> createState() => _RentalRequestsScreenState();
}

class _RentalRequestsScreenState extends State<RentalRequestsScreen> {
  late final WorkflowService service = widget.service ?? WorkflowService();
  List<Map<String, dynamic>> requests = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    if (widget.service == null) service.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final data = await service.list();
      if (mounted) {
        setState(() {
          requests = data;
          error = null;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = _error(e);
          loading = false;
        });
      }
    }
  }

  Future<void> open(String id, {bool start = false}) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            RentalRequestDetail(service: service, id: id, autoStart: start),
      ),
    );
    if (mounted) await load();
  }

  Future<void> create() async {
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => RentalRequestForm(service: service)),
    );
    if (mounted && id != null) await open(id, start: true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.canCreate ? 'Rental requests' : 'Request inbox'),
      actions: [
        IconButton(
          tooltip: 'Refresh requests',
          onPressed: load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          PageIntro(
            eyebrow: 'RENTAL CONCIERGE',
            title: widget.canCreate
                ? 'A place to call home.'
                : 'Good plans. Clear decisions.',
            description: widget.canCreate
                ? 'Your preferences, a considered match and a clear plan for moving in.'
                : 'Review the home, dates and terms before approving a rental draft.',
          ),
          const SizedBox(height: 24),
          if (loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ),
            ),
          if (error != null) _ErrorCard(error!, onRetry: load),
          if (!loading && error == null && requests.isEmpty)
            const _Section(
              title: 'Nothing here yet',
              child: Text(
                'New rental requests will appear here. Pull down any time to refresh.',
              ),
            ),
          ...requests.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 12,
                  ),
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.softTeal,
                    child: Icon(Icons.home_outlined, color: AppColors.teal),
                  ),
                  title: Text(
                    requestStatuses[r['status']] ?? '${r['status']}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('Requested ${_date(r['createdAt'])}'),
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => open(r['id'] as String),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
    floatingActionButton: widget.canCreate
        ? FloatingActionButton.extended(
            onPressed: create,
            icon: const Icon(Icons.add),
            label: const Text('Find a home'),
          )
        : null,
  );
}

class RentalRequestForm extends StatefulWidget {
  final WorkflowService service;
  final String? requestId;
  final Map<String, dynamic>? initial;
  const RentalRequestForm({
    super.key,
    required this.service,
    this.requestId,
    this.initial,
  });
  @override
  State<RentalRequestForm> createState() => _RentalRequestFormState();
}

class _RentalRequestFormState extends State<RentalRequestForm> {
  final form = GlobalKey<FormState>();
  late final objective = TextEditingController(
    text: widget.initial?['objective']?.toString(),
  );
  late final budget = TextEditingController(
    text: widget.initial?['maxMonthlyRent']?.toString(),
  );
  DateTime? start, end;
  int step = 0;
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    start = DateTime.tryParse('${widget.initial?['startDate']}');
    end = DateTime.tryParse('${widget.initial?['endDate']}');
  }

  @override
  void dispose() {
    objective.dispose();
    budget.dispose();
    super.dispose();
  }

  Future<void> pick(bool first) async {
    final today = DateUtils.dateOnly(DateTime.now());
    final minimum = first
        ? today
        : (start ?? today).add(const Duration(days: 1));
    final current = first ? start : end;
    final selected = await showDatePicker(
      context: context,
      firstDate: minimum,
      lastDate: today.add(const Duration(days: 365 * 6)),
      initialDate: current == null || current.isBefore(minimum)
          ? minimum
          : current,
    );
    if (selected != null && mounted) {
      setState(() {
        if (first) {
          start = selected;
          if (end != null && !end!.isAfter(selected)) {
            end = null;
          }
        } else {
          end = selected;
        }
      });
    }
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (step == 0) {
      setState(() => step = 1);
      return;
    }
    if (start == null || end == null || !end!.isAfter(start!)) {
      setState(
        () => error = 'Choose a move-in date and a later lease end date.',
      );
      return;
    }
    if (end!.isAfter(DateTime(start!.year + 5, start!.month, start!.day))) {
      setState(() => error = 'Choose a lease period of five years or less.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final request = {
        'objective': objective.text.trim(),
        'maxMonthlyRent': double.parse(budget.text),
        'startDate': DateFormat('yyyy-MM-dd').format(start!),
        'endDate': DateFormat('yyyy-MM-dd').format(end!),
      };
      final String id;
      if (widget.requestId == null) {
        id = await widget.service.create(request);
      } else {
        id = widget.requestId!;
        await widget.service.revise(id, request);
      }
      if (mounted) Navigator.pop(context, id);
    } catch (e) {
      if (mounted) {
        setState(() {
          error = _error(e);
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.requestId == null
            ? 'Your rental preferences'
            : 'Update preferences',
      ),
    ),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'STEP ${step + 1} OF 2',
            style: const TextStyle(
              color: AppColors.muted,
              letterSpacing: 1.2,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            step == 0 ? 'What feels like home?' : 'Make room for your plans.',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          Text(
            step == 0
                ? 'Tell us about your preferred area, space and must-have features.'
                : 'Set a monthly budget and the dates you have in mind.',
            style: const TextStyle(color: AppColors.muted, height: 1.5),
          ),
          const SizedBox(height: 28),
          if (step == 0)
            TextFormField(
              key: const ValueKey('objective'),
              controller: objective,
              maxLines: 5,
              maxLength: 2000,
              decoration: const InputDecoration(
                labelText: 'Your ideal home',
                alignLabelWithHint: true,
                hintText: 'A two-bedroom home in Malabe with parking...',
              ),
              validator: (v) => (v?.trim().length ?? 0) < 10
                  ? 'Add a little more detail (at least 10 characters).'
                  : null,
            ),
          if (step == 1) ...[
            TextFormField(
              key: const ValueKey('budget'),
              controller: budget,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Monthly budget',
                prefixText: 'LKR ',
              ),
              validator: (v) {
                final amount = double.tryParse(v ?? '');
                return amount == null ||
                        !amount.isFinite ||
                        amount <= 0 ||
                        amount > 10000000
                    ? 'Enter a budget between 1 and 10,000,000.'
                    : null;
              },
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: busy ? null : () => pick(true),
              icon: const Icon(Icons.calendar_today_outlined),
              label: Text(
                start == null
                    ? 'Choose move-in date'
                    : 'Move in: ${_date(start)}',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: busy ? null : () => pick(false),
              icon: const Icon(Icons.event_outlined),
              label: Text(
                end == null
                    ? 'Choose lease end date'
                    : 'Lease ends: ${_date(end)}',
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'The owner reviews your proposal before an agreement draft is saved. No payment or booking happens at this step.',
              style: TextStyle(color: AppColors.muted, height: 1.5),
            ),
          ],
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: _ErrorCard(error!),
            ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: busy ? null : submit,
            child: busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    step == 0
                        ? 'Continue'
                        : widget.requestId == null
                        ? 'Find my next home'
                        : 'Update my proposal',
                  ),
          ),
          if (step == 1)
            TextButton(
              onPressed: busy ? null : () => setState(() => step = 0),
              child: const Text('Back to preferences'),
            ),
        ],
      ),
    ),
  );
}

class RentalRequestDetail extends StatefulWidget {
  final WorkflowService service;
  final String id;
  final bool autoStart;
  const RentalRequestDetail({
    super.key,
    required this.service,
    required this.id,
    this.autoStart = false,
  });
  @override
  State<RentalRequestDetail> createState() => _RentalRequestDetailState();
}

class _RentalRequestDetailState extends State<RentalRequestDetail> {
  Map<String, dynamic>? run;
  bool busy = false, refreshing = false;
  String? error;
  Timer? timer;
  final note = TextEditingController();
  int tab = 0;
  @override
  void initState() {
    super.initState();
    load().then((_) {
      if (mounted && run?['canAdvance'] == true && run?['status'] == 'Ready') {
        prepare();
      }
    });
    timer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (!busy &&
          !refreshing &&
          ['Ready', 'Executing', 'AwaitingApproval'].contains(run?['status'])) {
        load();
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    note.dispose();
    super.dispose();
  }

  Future<void> load() async {
    if (refreshing) return;
    refreshing = true;
    try {
      final data = await widget.service.get(widget.id);
      if (mounted) {
        setState(() {
          run = data;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = _error(e));
    } finally {
      refreshing = false;
    }
  }

  Future<void> action(Future<void> Function() work) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await work();
    } catch (e) {
      if (mounted) setState(() => error = _error(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> prepare() => action(() async {
    do {
      await widget.service.advance(widget.id);
      final data = await widget.service.get(widget.id);
      if (!mounted) return;
      setState(() => run = data);
    } while (run?['status'] == 'Ready');
  });
  Future<void> decision(String value) async {
    if (value != 'approve' && note.text.trim().isEmpty) {
      setState(() => error = 'Add a note to explain your decision.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          value == 'approve'
              ? 'Save this agreement draft?'
              : value == 'reject'
              ? 'Decline this proposal?'
              : 'Request changes?',
        ),
        content: Text(
          value == 'approve'
              ? 'The displayed terms will be saved as a draft. This does not activate a tenancy.'
              : 'Your note will be shared with the tenant.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await action(() async {
      await widget.service.decide(
        widget.id,
        value,
        note.text.trim(),
        run!['version'] as int,
      );
      await load();
    });
  }

  Future<void> delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete rental request?'),
        content: const Text(
          'This removes the request from your list. Any saved agreement stays unchanged.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep request'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete request'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await action(() async {
      await widget.service.delete(widget.id);
      if (mounted) Navigator.pop(context);
    });
  }

  Future<void> revise() async {
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => RentalRequestForm(
          service: widget.service,
          requestId: widget.id,
          initial: Map<String, dynamic>.from(run!['state']['request']),
        ),
      ),
    );
    if (mounted && id != null) {
      await load();
      if (mounted) await prepare();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = run?['state'] as Map? ?? {};
    final outputs = state['outputs'] as Map? ?? {};
    final request = state['request'] as Map? ?? {};
    final status = run?['status'];
    final preparing = status == 'Ready' || status == 'Executing';
    final canAdvance = run?['canAdvance'] == true;
    final updated = DateTime.tryParse('${run?['updatedAt']}');
    final executing =
        status == 'Executing' &&
        (updated == null ||
            DateTime.now().toUtc().difference(updated.toUtc()).inMinutes < 3);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your rental plan'),
        actions: [
          IconButton(
            tooltip: 'Refresh proposal',
            onPressed: busy ? null : load,
            icon: const Icon(Icons.refresh),
          ),
          if (canAdvance)
            IconButton(
              tooltip: 'Delete request',
              onPressed: busy || executing ? null : delete,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (error != null) _ErrorCard(error!, onRetry: busy ? null : load),
            if (run == null && error == null)
              const Center(child: CircularProgressIndicator()),
            if (run != null) ...[
              Text(
                requestStatuses[status] ?? '$status',
                style: const TextStyle(
                  color: AppColors.teal,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '${request['objective']}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Chip(label: Text(_money(request['maxMonthlyRent']))),
                  Chip(
                    label: Text(
                      '${_date(request['startDate'])} - ${_date(request['endDate'])}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (preparing)
                _Section(
                  title: 'A little closer to home',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        preparationLabels[(state['plan'] as List)
                                .where((role) => !outputs.containsKey(role))
                                .firstOrNull] ??
                            'Preparing your proposal',
                      ),
                      const SizedBox(height: 18),
                      LinearProgressIndicator(
                        value: busy || executing
                            ? null
                            : outputs.length / (state['plan'] as List).length,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Your progress is saved as we go.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                      if (canAdvance && !busy && !executing)
                        TextButton(
                          onPressed: prepare,
                          child: const Text('Continue my proposal'),
                        ),
                    ],
                  ),
                ),
              if (status == 'Failed')
                _ErrorCard(
                  '${state['error'] ?? 'We could not finish this proposal.'}',
                  onRetry: canAdvance && !busy && (state['attempts'] as num) < 3
                      ? prepare
                      : null,
                ),
              if (!preparing && outputs.isNotEmpty) ...[
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 0, label: Text('Your match')),
                      ButtonSegment(value: 1, label: Text('Agreement')),
                      ButtonSegment(value: 2, label: Text('Move-in')),
                    ],
                    selected: {tab},
                    onSelectionChanged: (value) =>
                        setState(() => tab = value.first),
                  ),
                ),
                const SizedBox(height: 20),
                if (tab == 0)
                  _Section(
                    title: 'Why this home fits',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '${outputs['MatchingLocation']?['summary'] ?? 'A match is not available yet.'}',
                          style: const TextStyle(height: 1.6),
                        ),
                        if (outputs['MatchingLocation']?['propertyId'] != null)
                          _MatchedProperty(
                            id:
                                outputs['MatchingLocation']['propertyId']
                                    as String,
                          ),
                      ],
                    ),
                  ),
                if (tab == 1)
                  _Section(
                    title: 'Proposed agreement',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_money(outputs['AgreementPricing']?['monthlyRent'])} / month',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${outputs['AgreementPricing']?['summary'] ?? 'Your draft has not been prepared yet.'}',
                          style: const TextStyle(height: 1.6),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '${outputs['AgreementPricing']?['terms'] ?? ''}',
                          style: const TextStyle(height: 1.6),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Deposit: LKR 0 (not yet negotiated). This is a draft, not an active tenancy.',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                if (tab == 2)
                  _Section(
                    title: 'A smooth start',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${outputs['MaintenanceTriage']?['summary'] ?? 'Your handover plan has not been prepared yet.'}',
                        ),
                        for (final item
                            in outputs['MaintenanceTriage']?['checklist']
                                    as List? ??
                                [])
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(
                              Icons.check_circle_outline,
                              color: AppColors.teal,
                            ),
                            title: Text('$item'),
                          ),
                      ],
                    ),
                  ),
              ],
              if (status == 'AwaitingApproval')
                _Section(
                  title: run!['canReview'] == true
                      ? 'Review the proposal'
                      : 'Your owner has the next step',
                  child: run!['canReview'] == true
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Check the property, dates and terms before approving.',
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: note,
                              maxLines: 3,
                              maxLength: 2000,
                              decoration: const InputDecoration(
                                labelText: 'Note to the tenant',
                                hintText: 'Required for changes or a decline.',
                              ),
                            ),
                            FilledButton(
                              onPressed: busy
                                  ? null
                                  : tab == 1
                                  ? () => decision('approve')
                                  : () => setState(() => tab = 1),
                              child: Text(
                                tab == 1
                                    ? 'Approve and save draft'
                                    : 'Review agreement',
                              ),
                            ),
                            TextButton(
                              onPressed: busy ? null : () => decision('revise'),
                              child: const Text('Request changes'),
                            ),
                            TextButton(
                              onPressed: busy ? null : () => decision('reject'),
                              child: const Text('Decline proposal'),
                            ),
                          ],
                        )
                      : const Text(
                          'Your owner or an administrator will review the proposal. Updates from the web or mobile app will appear here.',
                        ),
                ),
              if (status == 'RevisionRequested' && canAdvance)
                FilledButton(
                  onPressed: busy ? null : revise,
                  child: const Text('Update my preferences'),
                ),
              if (run!['agreementId'] != null)
                FilledButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const MyRentalsScreen()),
                  ),
                  icon: const Icon(Icons.description_outlined),
                  label: const Text('View my agreements'),
                ),
              for (final decision in state['decisions'] as List? ?? [])
                _Section(
                  title: 'Reviewer update',
                  child: Text(
                    '${decision['note'] == '' ? 'Your proposal was approved.' : decision['note']}',
                  ),
                ),
              const SizedBox(height: 12),
              ExpansionTile(
                title: const Text('Request activity'),
                children: [
                  SelectableText(
                    'Reference: ${widget.id}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.muted,
                    ),
                  ),
                  for (final step in run!['steps'] as List)
                    ListTile(
                      title: Text(
                        preparationLabels[step['agentName']] ??
                            'Request updated',
                      ),
                      subtitle: Text(
                        '${step['validationResult']}'.startsWith('Passed')
                            ? 'Complete'
                            : '${step['validationResult']}' == 'Running'
                            ? 'In progress'
                            : 'Needs attention',
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    ),
  );
}

class _MatchedProperty extends ConsumerWidget {
  final String id;
  const _MatchedProperty({required this.id});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.only(top: 20),
    child: ref
        .watch(propertyDetailsProvider(id))
        .when(
          loading: () => const LinearProgressIndicator(),
          error: (_, _) => TextButton(
            onPressed: () => ref.invalidate(propertyDetailsProvider(id)),
            child: const Text('Reload property details'),
          ),
          data: (property) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (property.photoUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: AspectRatio(
                    aspectRatio: 16 / 10,
                    child: Image.network(
                      property.photoUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const ColoredBox(
                        color: AppColors.softTeal,
                        child: Icon(
                          Icons.home_outlined,
                          size: 48,
                          color: AppColors.teal,
                        ),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              Text(
                property.title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                property.address,
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => PropertyDetailScreen(property: property),
                  ),
                ),
                icon: const Icon(Icons.home_outlined),
                label: const Text('Explore this home'),
              ),
            ],
          ),
        ),
  );
}

class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const _ErrorCard(this.message, {this.onRetry});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, color: AppColors.amber),
            const SizedBox(height: 12),
            Text(message),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    ),
  );
}
