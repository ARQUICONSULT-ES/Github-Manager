"use client";

import { useMemo, useState } from "react";
import type { Application } from "@/modules/applications/types";

export function useApplicationFilter(applications: Application[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [publisherFilter, setPublisherFilter] = useState<string>("all");

  const publishers = useMemo(() => {
    const uniquePublishers = new Set(applications.map(app => app.publisher));
    return Array.from(uniquePublishers).sort();
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.publisher.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.githubRepoName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPublisher = 
        publisherFilter === "all" || app.publisher === publisherFilter;

      return matchesSearch && matchesPublisher;
    });
  }, [applications, searchQuery, publisherFilter]);

  return {
    filteredApplications,
    searchQuery,
    setSearchQuery,
    publisherFilter,
    setPublisherFilter,
    publishers,
  };
}
