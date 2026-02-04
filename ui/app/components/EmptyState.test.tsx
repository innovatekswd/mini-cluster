import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState, EmptyStatePresets } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No items found"
        description="Try adjusting your search"
      />
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your search")).toBeInTheDocument();
  });

  it("renders with default variant", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: "Add Item", onClick: handleClick }}
      />
    );

    const button = screen.getByText("Add Item");
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action when provided", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        secondaryAction={{ label: "Learn More", onClick: handleClick }}
      />
    );

    const link = screen.getByText("Learn More");
    expect(link).toBeInTheDocument();
    
    fireEvent.click(link);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders custom icon when provided", () => {
    const customIcon = <span data-testid="custom-icon">🎉</span>;
    render(<EmptyState title="Test" icon={customIcon} />);
    
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});

describe("EmptyStatePresets", () => {
  it("renders NoAppsSelected preset", () => {
    render(<EmptyStatePresets.NoAppsSelected />);
    expect(screen.getByText("No apps selected")).toBeInTheDocument();
  });

  it("renders NoServicesFound preset", () => {
    render(<EmptyStatePresets.NoServicesFound />);
    expect(screen.getByText("No services found")).toBeInTheDocument();
  });

  it("renders NoSearchResults preset with query", () => {
    render(<EmptyStatePresets.NoSearchResults query="test query" />);
    expect(screen.getByText('No items matching "test query"')).toBeInTheDocument();
  });

  it("renders LoadError preset with retry action", () => {
    const handleRetry = vi.fn();
    render(<EmptyStatePresets.LoadError onRetry={handleRetry} />);
    
    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    
    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
