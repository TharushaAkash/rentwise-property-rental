import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class PageIntro extends StatelessWidget {
  const PageIntro({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.icon = Icons.home_work_outlined,
  });
  final String eyebrow, title, description;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.softTeal,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: AppColors.teal, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                eyebrow.toUpperCase(),
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.ink,
            fontSize: 27,
            height: 1.12,
            fontWeight: FontWeight.w700,
            letterSpacing: -.8,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          description,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 13,
            height: 1.5,
          ),
        ),
      ],
    ),
  );
}

class FormHeading extends StatelessWidget {
  const FormHeading(
    this.title,
    this.subtitle, {
    super.key,
    this.icon = Icons.edit_outlined,
  });
  final String title, subtitle;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 20),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            color: AppColors.softTeal,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, size: 21, color: AppColors.teal),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  color: AppColors.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.5,
                  color: AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class DetailLine extends StatelessWidget {
  const DetailLine(this.label, this.value, {super.key});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(
              color: AppColors.ink,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ],
    ),
  );
}
